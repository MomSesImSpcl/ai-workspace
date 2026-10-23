import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activityLabel, agentEnv, claudePermissions, sessionEvents } from '../src/adapters/claude-code.ts';
import { codexActivity, parseCodexModels } from '../src/adapters/codex.ts';
import { addMessage, createSession, emit, GLOBAL, listSessions, loadSession, readEvents, reorderPinned, requestStop, saveSession, sessionRoot, setPinned, turnPrompt, turns, fingerprint, type AgentProcess, type SessionAgent } from '../src/sessions.ts';
import { runTurn } from '../src/turn.ts';
import { serve } from '../src/ui.ts';
import { listProjects, migrateStorage, registerProject, removeProject, setWorkspaceRoot, unaddedFolders } from '../src/store.ts';

let root = '';
beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'ws-sessions-'));
  process.env.AI_WORKSPACE_HOME = join(dir, 'home');
  process.env.CLAUDE_CONFIG_DIR = join(dir, 'claude-home');
  root = join(dir, 'project');
  mkdirSync(root);
  registerProject(root, 'TEST');
});

const claude = { integration: 'claude-code' };
const fake = (turn: AgentProcess['turn']): Record<string, SessionAgent> => ({ 'claude-code': { open: () => ({ turn, close() {} }), permissions: () => ({ line: 'fake' }), catalog: () => ({ models: [] }), inventory: async () => [] } });

test('sessions are listed only in their own project, newest activity first', async () => {
  const other = mkdtempSync(join(tmpdir(), 'ws-other-'));
  registerProject(other, 'BLABLA');
  const a = createSession('TEST', 'Implementation', claude);
  createSession('BLABLA', 'Implementation', claude);
  const b = createSession('TEST', 'Implementation', claude);
  await new Promise((r) => setTimeout(r, 5)); // timestamps have millisecond resolution
  addMessage(a.id, 'first message\nsecond line');
  assert.deepEqual(listSessions('TEST').map((s) => s.id), [a.id, b.id]);
  assert.equal(listSessions('BLABLA').length, 1);
  assert.equal(loadSession(a.id).title, 'first message');
});

test('a turn streams text and activity, records usage and ends done; the vendor id is kept as a hint', async () => {
  const s = createSession('TEST', 'Implementation', claude);
  addMessage(s.id, 'hi');
  await runTurn(s.id, fake(async ({ emit: say }) => {
    say({ type: 'activity', id: 'a1', label: 'Reading `a.txt`' });
    say({ type: 'activity-done', id: 'a1' });
    say({ type: 'text', text: 'Hel' });
    say({ type: 'text', text: 'lo' });
    say({ type: 'activity', id: 'a2', label: 'Reading `b.txt`' });
    say({ type: 'activity-done', id: 'a2' });
    say({ type: 'text', text: 'Done.' });
    say({ type: 'usage', usage: { inputTokens: 10, outputTokens: 2 } });
    return { vendorSessionId: 'v1' };
  }));
  const [t] = turns(readEvents(s.id), false);
  assert.equal(t.state, 'done');
  assert.equal(t.text, 'Hello\n\nDone.'); // pieces of one run join; a run after a tool step is a new paragraph
  assert.equal(t.activity.length, 2);
  assert.equal(t.usage.inputTokens, 10);
  assert.equal(t.marker, undefined);
  assert.equal(loadSession(s.id).vendorSessionId, 'v1');
});

test('Stop ends the turn with a marker naming the last completed step; the next message carries it', async () => {
  const s = createSession('TEST', 'Implementation', claude);
  addMessage(s.id, 'edit things');
  await runTurn(s.id, fake(({ emit: say, signal }) => {
    say({ type: 'activity', id: 'a1', label: 'Editing `ui.html`' });
    say({ type: 'activity-done', id: 'a1' });
    say({ type: 'activity', id: 'a2', label: 'Running `npm test`' });
    requestStop(s.id);
    return new Promise((r) => signal.addEventListener('abort', () => r({})));
  }));
  const [t] = turns(readEvents(s.id), false);
  assert.equal(t.state, 'stopped');
  assert.equal(t.marker, 'Stopped after step 1: Editing `ui.html`');
  addMessage(s.id, 'go on');
  assert.match(turnPrompt(turns(readEvents(s.id), true)), /^\[Stopped after step 1: Editing `ui.html`\. Check the current project state.*\]\n\ngo on$/s);
});

test('a turn whose runner died is interrupted; the marker is recorded when the user continues', () => {
  const s = createSession('TEST', 'Implementation', claude);
  addMessage(s.id, 'work');
  emit(s.id, 1, { type: 'activity', id: 'a1', label: 'Reading `a.txt`' });
  emit(s.id, 1, { type: 'activity-done', id: 'a1' });
  assert.equal(turns(readEvents(s.id), true)[0].state, 'working');
  assert.equal(turns(readEvents(s.id), false)[0].marker, 'Interrupted after step 1: Reading `a.txt`');
  assert.equal(addMessage(s.id, 'continue'), 2);
  assert.ok(readEvents(s.id).some((e) => e.type === 'interrupted' && e.turn === 1 && e.step === 1));
  const ts = turns(readEvents(s.id), false);
  assert.equal(ts[0].state, 'interrupted');
  assert.match(turnPrompt(ts), /Interrupted after step 1/);
});

test('agent errors end the turn as failed and keep the activity', async () => {
  const s = createSession('TEST', 'Implementation', claude);
  addMessage(s.id, 'x');
  await runTurn(s.id, fake(async () => ({ error: 'boom' })));
  const [t] = turns(readEvents(s.id), false);
  assert.equal(t.state, 'error');
  assert.equal(t.error, 'boom');
  assert.equal(t.marker, 'Failed before the first step');
});

test('claude stream lines map to the event contract', () => {
  const init = sessionEvents(JSON.stringify({ type: 'system', subtype: 'init', session_id: 's1', permissionMode: 'default', memory_paths: { auto: 'C:/u/memory/' },
    plugins: [{ name: 'caveman', path: 'C:/p' }, { name: 'cc-plugin-telemetry', path: 'builtin' }], mcp_servers: [{ name: 'caveman', status: 'connected' }, { name: 'aiws', status: 'connected' }], skills: ['a', 'b'] }), root);
  assert.deepEqual(init.events, [{ type: 'init', model: undefined, permissionMode: 'default', ruleFiles: ['C:/u/memory/'], plugins: ['caveman'], mcp: [{ name: 'caveman', status: 'connected' }, { name: 'aiws', status: 'connected' }], skills: 2 }]);
  assert.equal(init.sessionId, 's1');
  const delta = sessionEvents(JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } } }), root);
  assert.deepEqual(delta.events, [{ type: 'text', text: 'Hi' }]);
  const use = sessionEvents(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hi' }, { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test' } }] } }), root);
  assert.deepEqual(use.events, [{ type: 'activity', id: 't1', label: 'Running `npm test`', fp: fingerprint('Bash', { command: 'npm test' }) }]);
  const res = sessionEvents(JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', is_error: true }] } }), root);
  assert.deepEqual(res.events, [{ type: 'activity-done', id: 't1', error: true }]);
  const dropped = sessionEvents(JSON.stringify({ type: 'system', subtype: 'informational', content: 'Prompt dropped by a hook: x', level: 'warning', prevent_continuation: true }), root);
  assert.deepEqual(dropped.events, [{ type: 'notice', text: 'Prompt dropped by a hook: x', blocked: true }]);
  const done = sessionEvents(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'ok', session_id: 's1', usage: { input_tokens: 5, output_tokens: 1 } }), root);
  assert.equal(done.result?.text, 'ok');
  assert.equal(done.result?.error, undefined);
});

test('edits outside the project folder are flagged; paths inside are shown relative', () => {
  assert.deepEqual(activityLabel('Edit', { file_path: join(root, 'src', 'a.ts') }, root), { label: 'Editing `src/a.ts`', outside: undefined });
  assert.equal(activityLabel('Write', { file_path: join(root, '..', 'x.txt') }, root).outside, true);
  assert.equal(activityLabel('mcp__ws__delegate', {}, root).label, 'Using ws delegate');
  assert.equal(activityLabel('PowerShell', { command: 'Get-ChildItem' }, root).label, 'Running `Get-ChildItem`');
  assert.equal(activityLabel('mcp__gh__search', { query: 'open issues', limit: 5 }, root).label, 'Using gh search: open issues');
});

test('codex app-server items map to activity rows with fingerprints; other items are not tool calls', () => {
  assert.deepEqual(codexActivity({ type: 'commandExecution', id: 'i1', command: 'ls' }), { label: 'Running `ls`', fp: fingerprint('commandExecution', 'ls') });
  assert.equal(codexActivity({ type: 'fileChange', id: 'i2', changes: [{ path: 'a.ts' }] })?.label, 'Editing `a.ts`');
  assert.equal(codexActivity({ type: 'mcpToolCall', id: 'i3', server: 'aiws', tool: 'delegate', arguments: { goal: 'x' } })?.label, 'Using aiws delegate');
  assert.equal(codexActivity({ type: 'agentMessage', id: 'i4', text: 'hi' }), null);
});

test('claude permission summary merges user and project settings and warns on bypass', () => {
  mkdirSync(process.env.CLAUDE_CONFIG_DIR!, { recursive: true });
  writeFileSync(join(process.env.CLAUDE_CONFIG_DIR!, 'settings.json'), JSON.stringify({ permissions: { allow: ['Read'], deny: ['Bash(git push:*)'] } }));
  mkdirSync(join(root, '.claude'));
  writeFileSync(join(root, '.claude', 'settings.json'), JSON.stringify({ permissions: { ask: ['Bash'] } }));
  assert.deepEqual(claudePermissions(root), { line: 'Claude Code · mode default · deny: Bash(git push:*) · ask: Bash · 1 allow rules', warn: undefined });
  writeFileSync(join(root, '.claude', 'settings.local.json'), JSON.stringify({ permissions: { defaultMode: 'bypassPermissions' } }));
  assert.match(claudePermissions(root).warn ?? '', /skips all permission checks/);
});

test('session API creates, renames, archives and deletes; approvals need a pending request', async () => {
  const server = serve(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const post = async (path: string, body: unknown) => {
    const res = await fetch(base + path, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  };
  try {
    const { data: s } = await post('/api/sessions', { projectId: 'TEST', role: 'Implementation' });
    assert.equal(s.integration, 'claude-code');
    assert.equal((await post('/api/sessions', { projectId: 'TEST', role: 'ArchitectureReasoning' })).status, 400); // no such role
    assert.equal((await post('/api/roles', { role: 'Chat', integration: 'claude-code', model: 'no-such-model' })).status, 400);
    assert.equal((await post('/api/roles', { role: 'Implementation', integration: 'claude-code', permissionMode: 'nope' })).status, 400);
    assert.equal((await post('/api/roles', { role: 'Implementation', integration: 'claude-code', permissionMode: 'manual' })).data.Implementation.permissionMode, 'manual');
    assert.equal((await post('/api/settings', { chatInstructions: 'Answer in German.' })).data.chatInstructions, 'Answer in German.');
    assert.equal((await post(`/api/sessions/${s.id}/rename`, { title: 'Login bug' })).data.title, 'Login bug');
    assert.equal((await post(`/api/sessions/${s.id}/archive`, { archived: true })).data.archived, true);
    assert.equal((await post(`/api/sessions/${s.id}/approve`, { approval: 'nope', allow: true })).status, 409);
    const view = await (await fetch(`${base}/api/sessions/${s.id}`)).json();
    assert.match(view.permissions.line, /^Claude Code/);
    assert.equal((await (await fetch(`${base}/api/sessions?project=TEST`)).json()).length, 1);
    await post(`/api/sessions/${s.id}/delete`, {});
    assert.equal((await (await fetch(`${base}/api/sessions?project=TEST`)).json()).length, 0);
  } finally {
    server.close();
  }
});

test('variables of a Claude Code host are dropped so the settings env of the user applies', () => {
  assert.deepEqual(agentEnv({ PATH: 'p', ANTHROPIC_BASE_URL: 'x' }), { PATH: 'p', ANTHROPIC_BASE_URL: 'x' });
  assert.deepEqual(agentEnv({ PATH: 'p', CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'd', ANTHROPIC_BASE_URL: 'x' }), { PATH: 'p' });
});

test('workspace folder is stored only when it is an existing absolute folder', async () => {
  const server = serve(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const set = (root: string) => fetch(`${base}/api/workspace`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ root }) });
  try {
    assert.equal((await (await fetch(`${base}/api/meta`)).json()).workspaceRoot, null);
    assert.equal((await set('relative/dir')).status, 400);
    assert.equal((await set(join(root, 'missing'))).status, 400);
    assert.equal((await set(root)).status, 200);
    assert.equal((await (await fetch(`${base}/api/meta`)).json()).workspaceRoot, root);
  } finally {
    server.close();
  }
});

test('archiving a project hides it and keeps its data; ids with spaces work', async () => {
  const spaced = mkdtempSync(join(tmpdir(), 'ws-spaced-'));
  registerProject(spaced, 'My Project');
  const s = createSession('My Project', 'Implementation', claude);
  const server = serve(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const archive = (archived: boolean) => fetch(`${base}/api/projects/${encodeURIComponent('My Project')}/archive`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ archived }) });
  try {
    assert.equal((await (await archive(true)).json()).archived, true);
    const listed = (await (await fetch(`${base}/api/meta`)).json()).projects.find((p: { id: string }) => p.id === 'My Project');
    assert.equal(listed.archived, true);
    assert.equal(loadSession(s.id).projectId, 'My Project'); // sessions untouched
    assert.equal((await (await archive(false)).json()).archived, undefined);
    assert.equal((await fetch(`${base}/api/projects/missing/archive`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: '{}' })).status, 400);
  } finally {
    server.close();
  }
});

test('removing a project drops only its reference; workspace subfolders not yet added are listed', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'ws-root-'));
  mkdirSync(join(ws, 'alpha'));
  mkdirSync(join(ws, 'beta'));
  mkdirSync(join(ws, '.hidden'));
  setWorkspaceRoot(ws);
  registerProject(join(ws, 'alpha'), 'alpha');
  assert.deepEqual(unaddedFolders(), [join(ws, 'beta')]);
  const s = createSession('alpha', 'Implementation', claude);
  removeProject('alpha'); // no archive needed first
  assert.equal(listProjects().some((p) => p.id === 'alpha'), false);
  assert.ok(existsSync(join(ws, 'alpha'))); // folder untouched
  assert.equal(loadSession(s.id).projectId, 'alpha'); // history kept
  assert.deepEqual(unaddedFolders().sort(), [join(ws, 'alpha'), join(ws, 'beta')]);
});

test('view state is stored in workspace storage and survives a new server (new port)', async () => {
  const post = async (base: string, body: unknown) => (await fetch(`${base}/api/prefs`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify(body) })).status;
  for (const check of [false, true]) { // second round: a fresh server on another port
    const server = serve(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      if (!check) {
        assert.equal(await post(base, { key: 'session.My Project', value: 'abc' }), 200);
        assert.equal(await post(base, { key: 'page', value: 3 }), 400);
      } else assert.deepEqual(await (await fetch(`${base}/api/prefs`)).json(), { 'session.My Project': 'abc' });
    } finally {
      server.close();
    }
  }
});

test('global sessions run in the workspace folder; pinned sessions list first in their own order', () => {
  assert.throws(() => createSession(GLOBAL, 'Chat', claude), /workspace folder/);
  setWorkspaceRoot(root);
  const g = createSession(GLOBAL, 'Chat', claude);
  assert.equal(sessionRoot(g), root);
  assert.deepEqual(listSessions(GLOBAL).map((s) => s.id), [g.id]);
  assert.equal(listSessions('TEST').length, 0);
  const [a, b, c] = ['a', 'b', 'c'].map(() => createSession('TEST', 'Chat', claude));
  setPinned(a.id, true);
  setPinned(c.id, true);
  assert.deepEqual(listSessions('TEST').map((s) => s.id).slice(0, 2), [a.id, c.id]);
  reorderPinned([c.id, a.id]);
  assert.deepEqual(listSessions('TEST').map((s) => s.id), [c.id, a.id, b.id]);
  setPinned(c.id, false);
  assert.equal(listSessions('TEST')[0].id, a.id);
});

test('storage mirrors the workspace and old flat folders are migrated without losing files', () => {
  const home = process.env.AI_WORKSPACE_HOME!;
  // New items go straight into their project's or the global folder.
  setWorkspaceRoot(root);
  const p = createSession('TEST', 'Chat', claude);
  const g = createSession(GLOBAL, 'Chat', claude);
  assert.ok(existsSync(join(home, 'projects', 'TEST', 'sessions', `${p.id}.json`)));
  assert.ok(existsSync(join(home, 'global', 'sessions', `${g.id}.json`)));
  // An item in the old flat layout, with side files, and one whose runner is alive.
  mkdirSync(join(home, 'sessions'), { recursive: true });
  writeFileSync(join(home, 'sessions', 'old1.json'), JSON.stringify({ id: 'old1', projectId: 'A: B', title: 't', role: 'Chat', integration: 'claude-code', createdAt: '', updatedAt: '' }));
  writeFileSync(join(home, 'sessions', 'old1.jsonl'), '{"turn":1,"type":"user","text":"hi","at":""}\n');
  writeFileSync(join(home, 'sessions', 'busy.json'), JSON.stringify({ id: 'busy', projectId: 'TEST' }));
  writeFileSync(join(home, 'sessions', 'busy.pid'), String(process.pid));
  migrateStorage();
  assert.ok(existsSync(join(home, 'projects', 'A_ B', 'sessions', 'old1.json')));
  assert.equal(readEvents('old1')[0].type, 'user');
  assert.ok(existsSync(join(home, 'sessions', 'busy.json'))); // runner alive: left for a later run
  assert.equal(listSessions('TEST').some((s) => s.id === 'busy'), true);
  migrateStorage(); // idempotent
  assert.ok(existsSync(join(home, 'projects', 'A_ B', 'sessions', 'old1.jsonl')));
});

test('session agent config is checked against the catalog; a switch is marked and drops the old agent session', async () => {
  const server = serve(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const post = async (path: string, body: unknown) => {
    const res = await fetch(base + path, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  };
  try {
    const { data: s } = await post('/api/sessions', { projectId: 'TEST', role: 'Chat', model: 'opus', effort: 'max' });
    assert.deepEqual([s.integration, s.model, s.effort], ['claude-code', 'opus', 'max']);
    assert.equal((await post(`/api/sessions/${s.id}/config`, { effort: 'ultra' })).status, 400); // not a Claude Code level
    assert.equal((await post(`/api/sessions/${s.id}/config`, { model: 'gpt-x' })).status, 400);
    assert.equal((await post(`/api/sessions/${s.id}/config`, { integration: 'nope' })).status, 400);
    addMessage(s.id, 'hi');
    const saved = loadSession(s.id);
    saved.vendorSessionId = 'old';
    saveSession(saved);
    const sw = await post(`/api/sessions/${s.id}/config`, { integration: 'codex' });
    assert.equal(sw.status, 200);
    assert.equal(loadSession(s.id).vendorSessionId, undefined);
    assert.equal(loadSession(s.id).model, undefined); // the old agent's model does not carry over
    assert.deepEqual(turns(readEvents(s.id), false)[0].switchedTo, { from: 'claude-code', to: 'codex', model: undefined });
  } finally {
    server.close();
  }
});

test('codex model list is read from codex debug models, hidden models left out', () => {
  const json = JSON.stringify({ models: [
    { slug: 'm1', display_name: 'M1', visibility: 'list', default_reasoning_level: 'low', supported_reasoning_levels: [{ effort: 'low' }, { effort: 'ultra' }] },
    { slug: 'hidden', visibility: 'hide', supported_reasoning_levels: [{ effort: 'low' }] },
  ] });
  const c = parseCodexModels(json, 'm1');
  assert.deepEqual(c.models.map((m) => m.id), ['', 'm1']);
  assert.equal(c.models[0].label, 'Default (m1)');
  assert.deepEqual(c.models[0].efforts, ['low', 'ultra']);
});
