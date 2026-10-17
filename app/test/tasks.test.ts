import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseResult, sessionEvents } from '../src/adapters/claude-code.ts';
import { assignmentFor, getRoles, setRole } from '../src/roles.ts';
import { addMessage, createSession, emit, fingerprint, listSessions, loadSession, readEvents, repeatsFor, saveSession, sessionWorking, turnRunning, turns, type AgentProcess, type SessionAgent } from '../src/sessions.ts';
import { cancelTask, childrenOf, createTask, delegate, listTasks, migrateTasks, resumeTask, taskStatus, taskUsed } from '../src/tasks.ts';
import { hostSession, runTurn, sessionAgent } from '../src/turn.ts';
import { serve } from '../src/ui.ts';
import { registerProject } from '../src/store.ts';

let root = '';
beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'ws-tasks-'));
  process.env.AI_WORKSPACE_HOME = join(dir, 'home');
  process.env.CLAUDE_CONFIG_DIR = join(dir, 'claude-home');
  process.env.CLAUDE_BIN = fileURLToPath(new URL('./fake-claude.mjs', import.meta.url));
  process.env.CODEX_BIN = fileURLToPath(new URL('./fake-codex.mjs', import.meta.url));
  process.env.AI_WORKSPACE_SESSION_IDLE_MS = '300';
  root = join(dir, 'project');
  mkdirSync(root);
  registerProject(root, 'P');
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(check: () => boolean, ms = 10000): Promise<void> {
  for (const end = Date.now() + ms; Date.now() < end; await wait(50)) if (check()) return;
  throw new Error('timed out');
}
const last = (id: string) => turns(readEvents(id), turnRunning(id)).at(-1)!;
const status = (id: string) => taskStatus(loadSession(id), turns(readEvents(id), turnRunning(id)));
const task = (goal: string, tokenBudget = 10_000) => createTask({ projectId: 'P', goal, role: 'Implementation', tokenBudget });
const fake = (turn: AgentProcess['turn']): Record<string, SessionAgent> => ({ 'claude-code': { open: () => ({ turn, close() {} }), permissions: () => ({ line: 'fake' }), catalog: () => ({ models: [] }) } });

test('a task is a session with a budget, listed apart from chat sessions; a pending approval shows as waiting', () => {
  const t = task('do the thing');
  createSession('P', 'Chat', { integration: 'claude-code' });
  assert.deepEqual(listTasks().map((s) => s.id), [t.id]);
  assert.equal(listSessions('P').length, 1);
  assert.equal(t.title, 'do the thing');
  assert.equal(taskStatus(t, turns(readEvents(t.id), true)), 'running'); // its first turn waits for the runner
  assert.equal(status(t.id), 'interrupted'); // no runner came: resumable
  emit(t.id, 1, { type: 'start', integration: 'claude-code' });
  emit(t.id, 1, { type: 'approval', id: 'a1', tool: 'Bash', detail: 'rm x' });
  assert.equal(taskStatus(loadSession(t.id), turns(readEvents(t.id), true)), 'waiting');
  assert.throws(() => createTask({ projectId: 'P', goal: 'x', role: 'Implementation', tokenBudget: 1, permissionMode: 'yolo' }), /Unknown permission mode/);
});

test('the token cap ends the agent at once from streamed usage and pauses the task; resume needs a larger budget', async () => {
  const t = task('big job', 500);
  let reason: unknown;
  await runTurn(t.id, fake(({ emit: say, live, signal }) => new Promise((r) => {
    signal.addEventListener('abort', () => {
      reason = signal.reason;
      say({ type: 'usage', usage: { inputTokens: 600, outputTokens: 0 } });
      r({});
    });
    live!({ inputTokens: 300, outputTokens: 0 });
    live!({ inputTokens: 600, outputTokens: 0 });
  })));
  assert.equal(reason, 'kill');
  assert.equal(status(t.id), 'paused');
  assert.match(last(t.id).marker!, /token budget 500 reached/);
  assert.throws(() => resumeTask(t.id), /raise the budget/);
  resumeTask(t.id, 2000);
  await runTurn(t.id, fake(async ({ emit: say, prompt }) => {
    say({ type: 'text', text: prompt });
    return {};
  }));
  assert.equal(status(t.id), 'completed');
  assert.match(last(t.id).text, /token budget 500 reached.*Continue the task\.$/s);
});

test('cancel ends a working Claude Code task at once, not after the interrupt grace period', async () => {
  const t = task('slow work');
  const run = runTurn(t.id);
  await until(() => sessionWorking(t.id) && readEvents(t.id).some((e) => e.type === 'init'));
  const at = Date.now();
  cancelTask(t.id);
  await run;
  assert.ok(Date.now() - at < 5000);
  assert.equal(status(t.id), 'cancelled');
  assert.equal(last(t.id).state, 'stopped');
  assert.throws(() => addMessage(t.id, 'more'), /Task is cancelled/);
});

test('a re-run after an interruption knows which calls already ran; the Claude Code hook turns them into an ask', () => {
  const t = task('edit');
  emit(t.id, 1, { type: 'start', integration: 'claude-code' });
  emit(t.id, 1, { type: 'activity', id: 'x', label: 'Running `npm i`', fp: fingerprint('Bash', { command: 'npm i' }) });
  emit(t.id, 1, { type: 'activity-done', id: 'x' });
  emit(t.id, 1, { type: 'activity', id: 'y', label: 'Running `rm a`', fp: fingerprint('Bash', { command: 'rm a' }) });
  emit(t.id, 1, { type: 'activity-done', id: 'y', error: true }); // failed calls are not repeats
  resumeTask(t.id);
  const repeats = repeatsFor(turns(readEvents(t.id), true));
  assert.deepEqual([...repeats.values()], ['step 1: Running `npm i`']);
  const hook = (input: unknown) => spawnSync(process.execPath, [fileURLToPath(new URL('../src/repeat-hook.ts', import.meta.url)), t.id], { input: JSON.stringify(input), encoding: 'utf8', env: process.env }).stdout;
  const held = JSON.parse(hook({ tool_name: 'Bash', tool_input: { command: 'npm i' } }));
  assert.equal(held.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(held.hookSpecificOutput.permissionDecisionReason, /Possible repeat: step 1: Running `npm i`/);
  assert.equal(hook({ tool_name: 'Bash', tool_input: { command: 'rm a' } }), '');
});

test('codex app-server: approvals become cards and wait, text streams, usage is recorded, the thread is resumed', async () => {
  setRole('Implementation', { integration: 'codex' });
  const t = task('ask first');
  const host = hostSession(t.id);
  await until(() => last(t.id).approvals.length === 1);
  const card = last(t.id).approvals[0]!;
  assert.deepEqual([card.tool, card.detail], ['Shell', 'echo hi']);
  await wait(300);
  assert.equal(status(t.id), 'waiting');
  emit(t.id, 1, { type: 'approval-answer', id: card.id, allow: true });
  await until(() => last(t.id).state === 'done');
  const first = last(t.id);
  assert.match(first.text, /^codex turn 1 pid \d+$/);
  assert.deepEqual(first.activity.map((a) => [a.label, a.done, a.error]), [['Running `echo hi`', true, undefined]]);
  assert.equal(first.usage.inputTokens + first.usage.outputTokens, 12);
  assert.equal(first.ruleFiles?.[0], 'AGENTS.md');
  assert.equal(loadSession(t.id).vendorSessionId, 'thread-1');
  resumeTask(t.id, undefined, 'again');
  await until(() => last(t.id).n === 2 && last(t.id).state === 'done');
  assert.equal(last(t.id).text, first.text.replace('turn 1', 'turn 2')); // same process
  await host;
});

test('codex: the cap kills the process from streamed usage; Stop in a session interrupts the turn', async () => {
  setRole('Implementation', { integration: 'codex' });
  const t = task('spend tokens', 500);
  await runTurn(t.id);
  assert.equal(status(t.id), 'paused');
  assert.equal(taskUsed(loadSession(t.id)), 650);
  const s = createSession('P', 'Chat', { integration: 'codex' });
  addMessage(s.id, 'slow');
  const run = runTurn(s.id);
  await until(() => last(s.id).activity.length === 1);
  const { requestStop } = await import('../src/sessions.ts');
  requestStop(s.id);
  await run;
  assert.equal(last(s.id).state, 'stopped');
  assert.equal(last(s.id).reason, undefined);
});

test('codex has no pre-run check: a repeated call stops the task and names the earlier step', async () => {
  setRole('Implementation', { integration: 'codex' });
  const t = task('repeat it');
  emit(t.id, 1, { type: 'start', integration: 'codex' });
  emit(t.id, 1, { type: 'activity', id: 'c', label: 'Running `echo repeat`', fp: fingerprint('commandExecution', 'echo repeat') });
  emit(t.id, 1, { type: 'activity-done', id: 'c' });
  resumeTask(t.id, undefined, 'repeat it');
  await runTurn(t.id);
  assert.equal(status(t.id), 'paused');
  assert.match(last(t.id).marker!, /possible repeat: step 1: Running `echo repeat` already ran before the interruption/);
});

test('delegate runs a subtask under a role, charges the parent, reuses it for the same goal and has a depth limit', async () => {
  const parent = task('parent', 5000);
  const out = await delegate(parent.id, 'sub goal');
  const [child] = childrenOf(parent.id);
  assert.match(out, new RegExp(`^subtask ${child!.id} completed\\nturn 1 pid \\d+ effort default$`));
  assert.equal(child!.task!.tokenBudget, 5000);
  assert.equal(taskUsed(loadSession(parent.id)), 12);
  assert.equal(await delegate(parent.id, 'sub goal'), out);
  assert.equal(childrenOf(parent.id).length, 1);
  await assert.rejects(delegate(child!.id, 'deeper'), /depth limit/);
  cancelTask(parent.id);
  assert.equal(loadSession(child!.id).task!.cancelled, true);
});

test('tasks recorded before they were sessions are converted once and keep their conversation and state', () => {
  const dir = join(process.env.AI_WORKSPACE_HOME!, 'projects', 'P', 'tasks');
  mkdirSync(dir, { recursive: true });
  const at = '2026-10-01T10:00:00.000Z';
  writeFileSync(join(dir, 'old1.json'), JSON.stringify({ id: 'old1', projectId: 'P', goal: 'old goal', role: 'Implementation', integration: 'claude-code', write: true, status: 'paused', reason: 'token budget 10 reached', tokenBudget: 10, usage: { inputTokens: 8, outputTokens: 4 }, steps: 1,
    messages: [{ from: 'user', text: 'old goal', at }, { from: 'agent', text: 'did part', at }], createdAt: at, updatedAt: at }));
  assert.equal(migrateTasks(), 1);
  assert.equal(migrateTasks(), 0);
  assert.ok(existsSync(join(dir, 'old1.migrated.json')));
  const s = loadSession('old1');
  assert.deepEqual(s.task, { tokenBudget: 10 });
  const ts = turns(readEvents('old1'), false);
  assert.equal(ts[0]!.text, 'did part');
  assert.equal(taskStatus(s, ts), 'paused');
  assert.equal(taskUsed(s), 12);
});

test('roles keep independent assignments; integrations without a session agent fail explicitly', () => {
  assert.equal(assignmentFor('Implementation').integration, 'claude-code');
  setRole('Orchestration', { integration: 'not-built' });
  const roles = getRoles();
  assert.equal(roles.Orchestration!.integration, 'not-built');
  assert.equal(roles.ArchitectureReasoning!.integration, 'manual-browser');
  assert.throws(() => sessionAgent('not-built'), /cannot run sessions/);
});

test('claude result and per-message usage parsing', () => {
  const base = { session_id: 's', usage: { input_tokens: 10, cache_read_input_tokens: 5, output_tokens: 3 }, total_cost_usd: 0.01 };
  assert.deepEqual(parseResult(JSON.stringify({ ...base, subtype: 'success', is_error: false, result: 'hi' })), { text: 'hi', usage: { inputTokens: 15, outputTokens: 3, cachedInputTokens: 5, cacheWriteTokens: 0, costUsd: 0.01 } });
  assert.equal(parseResult(JSON.stringify({ ...base, subtype: 'error_during_execution', is_error: true })).error, 'error_during_execution');
  const msg = sessionEvents(JSON.stringify({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 4, cache_creation_input_tokens: 200, output_tokens: 1 }, content: [] } }), root);
  assert.deepEqual(msg.usage, { id: 'm1', usage: { inputTokens: 204, outputTokens: 1, cachedInputTokens: 0, cacheWriteTokens: 200 } });
});

test('ui API serves loopback requests and rejects foreign hosts, origins and non-JSON posts', async () => {
  const t = task('g', 1000);
  const server = serve(0);
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address() as { port: number };
  const base = `http://127.0.0.1:${port}`;
  const post = (path: string, headers: Record<string, string>, body = '{}') => fetch(base + path, { method: 'POST', headers, body });
  const json = { origin: base, 'content-type': 'application/json' };
  try {
    const list = await (await fetch(`${base}/api/tasks`)).json();
    assert.deepEqual([list[0].id, list[0].status, list[0].goal], [t.id, 'interrupted', 'g']); // no runner was started
    const detail = await (await fetch(`${base}/api/tasks/${t.id}`)).json();
    assert.equal(detail.turns[0].user, 'g');
    // fetch cannot override Host, which is what DNS rebinding sends
    const rebound = await new Promise<number>((r) => get({ port, path: '/api/tasks', headers: { host: `evil.test:${port}` } }, (res) => r(res.statusCode!)).end());
    assert.equal(rebound, 403);
    assert.equal((await post(`/api/tasks/${t.id}/cancel`, { 'content-type': 'application/json' })).status, 403);
    assert.equal((await post(`/api/tasks/${t.id}/resume`, { origin: base, 'content-type': 'text/plain' })).status, 415);
    assert.equal((await post('/api/tasks', json, JSON.stringify({ projectId: 'P', goal: 'x', role: 'Implementation', budget: 10, permissionMode: 'yolo' }))).status, 400);
    assert.equal((await (await post(`/api/tasks/${t.id}/cancel`, json)).json()).status, 'cancelled');
    assert.equal((await post(`/api/tasks/${t.id}/resume`, json)).status, 400);
    const add = (body: unknown) => post('/api/projects', json, JSON.stringify(body));
    assert.equal((await (await add({ path: root, id: 'web' })).json()).id, 'web');
    assert.equal((await add({ path: 'relative/dir' })).status, 400);
    const roles = await (await post('/api/roles', json, JSON.stringify({ role: 'Implementation', integration: 'codex', model: ' ' }))).json();
    assert.deepEqual(roles.Implementation, { integration: 'codex' });
    const s = loadSession(t.id);
    s.title = 'renamed';
    saveSession(s);
  } finally {
    server.close();
  }
});
