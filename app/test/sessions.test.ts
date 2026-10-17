import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activityLabel, agentEnv, claudePermissions, sessionEvents } from '../src/adapters/claude-code.ts';
import { codexSessionEvents } from '../src/adapters/codex.ts';
import { addMessage, createSession, emit, listSessions, loadSession, readEvents, requestStop, turnPrompt, turns, type SessionAgent } from '../src/sessions.ts';
import { runTurn } from '../src/turn.ts';
import { serve } from '../src/ui.ts';
import { registerProject } from '../src/store.ts';

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
const fake = (turn: SessionAgent['turn']): Record<string, SessionAgent> => ({ 'claude-code': { turn, permissions: () => ({ line: 'fake' }) } });

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
    say({ type: 'usage', usage: { inputTokens: 10, outputTokens: 2 } });
    return { vendorSessionId: 'v1' };
  }));
  const [t] = turns(readEvents(s.id), false);
  assert.equal(t.state, 'done');
  assert.equal(t.text, 'Hello');
  assert.equal(t.activity.length, 1);
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
    plugins: [{ name: 'caveman', path: 'C:/p' }, { name: 'cc-plugin-telemetry', path: 'builtin' }], mcp_servers: [{ name: 'caveman', status: 'connected' }, { name: 'wsapprove', status: 'connected' }], skills: ['a', 'b'] }), root);
  assert.deepEqual(init.events, [{ type: 'init', permissionMode: 'default', ruleFiles: ['C:/u/memory/'], plugins: ['caveman'], mcp: [{ name: 'caveman', status: 'connected' }], skills: 2 }]);
  assert.equal(init.sessionId, 's1');
  const delta = sessionEvents(JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } } }), root);
  assert.deepEqual(delta.events, [{ type: 'text', text: 'Hi' }]);
  const use = sessionEvents(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hi' }, { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test' } }] } }), root);
  assert.deepEqual(use.events, [{ type: 'activity', id: 't1', label: 'Running `npm test`' }]);
  const res = sessionEvents(JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', is_error: true }] } }), root);
  assert.deepEqual(res.events, [{ type: 'activity-done', id: 't1', error: true }]);
  const done = sessionEvents(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'ok', session_id: 's1', usage: { input_tokens: 5, output_tokens: 1 } }), root);
  assert.equal(done.result?.done, true);
});

test('edits outside the project folder are flagged; paths inside are shown relative', () => {
  assert.deepEqual(activityLabel('Edit', { file_path: join(root, 'src', 'a.ts') }, root), { label: 'Editing `src/a.ts`', outside: undefined });
  assert.equal(activityLabel('Write', { file_path: join(root, '..', 'x.txt') }, root).outside, true);
  assert.equal(activityLabel('mcp__ws__delegate', {}, root).label, 'Using ws delegate');
});

test('codex exec items map to activity and text; turn.completed ends the turn', () => {
  const cmd = codexSessionEvents(JSON.stringify({ type: 'item.completed', item: { id: 'i1', type: 'command_execution', command: 'ls', exit_code: 1 } }));
  assert.deepEqual(cmd.events, [{ type: 'activity', id: 'i1', label: 'Running `ls`' }, { type: 'activity-done', id: 'i1', error: true }]);
  assert.deepEqual(codexSessionEvents(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'hi' } })).events, [{ type: 'text', text: 'hi' }]);
  assert.equal(codexSessionEvents(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 3, output_tokens: 1 } })).done, true);
  assert.equal(codexSessionEvents(JSON.stringify({ type: 'turn.failed', error: { message: 'limit' } })).error, 'limit');
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
    assert.equal((await post('/api/sessions', { projectId: 'TEST', role: 'ArchitectureReasoning' })).status, 400); // manual-browser cannot run sessions
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
