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
import { addMessage, createSession, emit, fingerprint, listSessions, loadSession, readEvents, repeatsFor, saveSession, used, sessionWorking, turnRunning, turns, type AgentProcess, type SessionAgent } from '../src/sessions.ts';
import { cancelTask, childrenOf, createTask, delegate, listTasks, migrateTasks, pauseTask, renameTask, replyFromSession, resumeTask, startFromSession, startPendingTasks, taskStatus, taskUsed } from '../src/tasks.ts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { hostSession, runTurn, sessionAgent, startTurn } from '../src/turn.ts';
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
const fake = (turn: AgentProcess['turn']): Record<string, SessionAgent> => ({ 'claude-code': { open: () => ({ turn, close() {} }), permissions: () => ({ line: 'fake' }), catalog: () => ({ models: [] }), inventory: async () => [] } });

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
  assert.ok(readEvents(t.id).some((e) => e.type === 'live-usage')); // tokens show while the task works
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

test('a chat starts a task: the task records the chat, which shows it with its approvals and result, and takes replies', async () => {
  const chat = createSession('P', 'Chat', { integration: 'claude-code' });
  addMessage(chat.id, 'please start one');
  const t = startFromSession(chat.id, { goal: 'background goal', role: 'Implementation', tokenBudget: 5000 });
  assert.equal(t.task!.sessionId, chat.id);
  assert.deepEqual(last(chat.id).tasks, [t.id]);
  startPendingTasks(chat.id); // the chat's runner does this while its turn runs
  await until(() => status(t.id) === 'completed');
  assert.throws(() => startFromSession(t.id, { goal: 'x', role: 'Implementation', tokenBudget: 10 }), /delegate/);
  assert.throws(() => startFromSession(chat.id, { goal: 'x', role: 'Implementation', tokenBudget: 0 }), /token budget/);
  assert.throws(() => startFromSession(chat.id, { goal: 'x', role: 'Implementation', tokenBudget: 10, permissionMode: 'yolo' }), /Unknown permission mode/);
  const server = serve(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const view = await (await fetch(`${base}/api/sessions/${chat.id}`)).json();
    assert.deepEqual([view.tasks[t.id].status, view.tasks[t.id].session.id, view.tasks[t.id].pending], ['completed', chat.id, []]);
    assert.match(view.tasks[t.id].thread[0].text, /^turn 1/);
    emit(t.id, 1, { type: 'approval', id: 'a1', tool: 'Bash', detail: 'ls' }); // a card still open in a finished turn is not pending
    assert.deepEqual((await (await fetch(`${base}/api/sessions/${chat.id}`)).json()).tasks[t.id].pending, []);
    const r = await fetch(`${base}/api/tasks/${t.id}/reply`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ text: 'more' }) });
    assert.equal(r.status, 200);
    await until(() => turns(readEvents(t.id), turnRunning(t.id)).length === 2 && status(t.id) === 'completed');
  } finally {
    server.close();
  }
});

test('the workspace MCP server offers start_task to a chat session and delegate to a top-level task', async () => {
  const chat = createSession('P', 'Chat', { integration: 'claude-code' });
  const tools = async (id: string) => {
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../src/approval-server.ts', import.meta.url)), id], env: { ...process.env } as Record<string, string> }));
    try { return (await client.listTools()).tools.map((x) => x.name).sort(); } finally { await client.close(); }
  };
  assert.deepEqual(await tools(chat.id), ['approve', 'list_agents', 'rename_task', 'reply_task', 'start_task', 'task_status']);
  assert.deepEqual(await tools(task('t').id), ['approve', 'delegate']);
});

test('the orchestrator role cannot edit or run commands with either agent; a task of the same agent can', async () => {
  const orch = createSession('P', 'Orchestration', { integration: 'claude-code' });
  addMessage(orch.id, 'args');
  await runTurn(orch.id);
  const args = JSON.parse(last(orch.id).text) as string[];
  assert.match(args[args.indexOf('--disallowedTools') + 1]!, /Bash,Edit,Write/);
  assert.match(args[args.indexOf('--append-system-prompt') + 1]!, /workspace orchestrator/);
  const { setSettings } = await import('../src/sessions.ts');
  setSettings({ orchestratorInstructions: 'Keep goals under 50 words.' });
  const orch2 = createSession('P', 'Orchestration', { integration: 'claude-code' });
  addMessage(orch2.id, 'args');
  await runTurn(orch2.id);
  const args2 = JSON.parse(last(orch2.id).text) as string[];
  assert.match(args2[args2.indexOf('--append-system-prompt') + 1]!, /user's own instructions .*Keep goals under 50 words\./);
  const t = task('args');
  await runTurn(t.id);
  const targs = JSON.parse(last(t.id).text) as string[];
  assert.doesNotMatch(targs[targs.indexOf('--disallowedTools') + 1] ?? '', /Bash/);
  const codex = createSession('P', 'Orchestration', { integration: 'codex' });
  addMessage(codex.id, 'hi');
  await runTurn(codex.id);
  const init = readEvents(codex.id).find((e) => e.type === 'init');
  assert.equal(init?.type === 'init' && init.permissionMode, 'approval never · sandbox read-only');
});

test('tasks run uncapped unless asked; the chat cap applies; the chosen agent, model and effort are checked and recorded', () => {
  const chat = createSession('P', 'Orchestration', { integration: 'claude-code' });
  addMessage(chat.id, 'build it');
  assert.equal(startFromSession(chat.id, { goal: 'a', role: 'Implementation' }).task!.tokenBudget, undefined);
  saveSession({ ...loadSession(chat.id), taskCap: 3000 });
  assert.equal(startFromSession(chat.id, { goal: 'b', role: 'Implementation' }).task!.tokenBudget, 3000);
  const effort = sessionAgent('claude-code').catalog().models[0]!.efforts[0]!;
  const t = startFromSession(chat.id, { goal: 'c', role: 'Implementation', agent: 'codex', effort: undefined, reason: 'small fix' });
  assert.deepEqual([t.integration, t.task!.reason], ['codex', 'small fix']);
  assert.equal(startFromSession(chat.id, { goal: 'd', role: 'Implementation', effort }).effort, effort);
  assert.throws(() => startFromSession(chat.id, { goal: 'e', role: 'Implementation', effort: 'warp' }), /Unknown effort/);
  assert.throws(() => startFromSession(chat.id, { goal: 'f', role: 'Implementation', agent: 'none' }), /Unknown agent/);
});

test('orchestrator chats and tasks load only the chosen setup items, switched for the one run (orchestrator-005)', async () => {
  const { setGlobalRules, setItemState, getAgentSetup } = await import('../src/setup.ts');
  const { setWorkspaceRoot } = await import('../src/store.ts');
  writeFileSync(join(root, '..', 'AGENTS.md'), 'Workspace rule: be kind.');
  setWorkspaceRoot(join(root, '..'));
  const argsOf = async (id: string) => { await runTurn(id); return JSON.parse(last(id).text) as string[]; };
  const flag = (args: string[], f: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
  // The orchestrator: reading tools only, every listed item off, no global rules, the workspace's AGENTS.md added.
  const orch = createSession('P', 'Orchestration', { integration: 'claude-code' });
  addMessage(orch.id, 'args');
  let args = await argsOf(orch.id);
  assert.equal(flag(args, '--tools'), 'Read,Glob,Grep');
  assert.match(flag(args, '--disallowedTools')!, /mcp__claude_ai_github/);
  assert.equal(JSON.parse(flag(args, '--settings')!).enabledPlugins['demo@market'], false);
  assert.equal(flag(args, '--setting-sources'), 'project,local');
  assert.ok(args.includes('--disable-slash-commands') === false); // no standalone skills listed in this test's Claude home
  assert.match(flag(args, '--append-system-prompt')!, /workspace's own rules[\s\S]*be kind/);
  assert.deepEqual(getAgentSetup().inventory!['claude-code']!.map((i) => i.id), ['plugin:demo@market', 'mcp:claude.ai github']);
  // A task: an item the orchestrator decides loads only when picked; an always-on item always; global rules per role.
  setItemState('Implementation', 'claude-code', 'plugin:demo@market', 'on');
  setGlobalRules('Implementation', true);
  const plain = task('args');
  args = await argsOf(plain.id);
  assert.match(flag(args, '--disallowedTools')!, /mcp__claude_ai_github/);
  assert.equal(JSON.parse(flag(args, '--settings')!).enabledPlugins, undefined);
  assert.equal(flag(args, '--setting-sources'), undefined);
  const picked = createTask({ projectId: 'P', goal: 'args', role: 'Implementation', setup: ['mcp:claude.ai github'] });
  args = await argsOf(picked.id);
  assert.equal(flag(args, '--disallowedTools'), undefined);
  assert.ok(JSON.parse(flag(args, '--settings')!).hooks.PreToolUse.length); // the workspace's repeat hook stays
  assert.throws(() => setItemState('Chat', 'claude-code', 'x', 'on'), /Unknown role/);
  // Codex: plugins off per turn, MCP servers, apps, standalone skills and hooks off in the thread config.
  const cx = createSession('P', 'Orchestration', { integration: 'codex' });
  addMessage(cx.id, 'args');
  await runTurn(cx.id);
  const sent = JSON.parse(last(cx.id).text) as { config: Record<string, unknown>; developerInstructions: string; disabledPluginIds: string[] };
  assert.deepEqual(sent.disabledPluginIds, ['demo@market']);
  assert.equal(sent.config['mcp_servers.tools.enabled'], false);
  assert.equal(sent.config['features.apps'], false);
  assert.deepEqual(sent.config['skills.config'], [{ path: '/skills/own/SKILL.md', enabled: false }]);
  assert.ok(sent.config['mcp_servers.aiws']);
  assert.match(sent.developerInstructions, /workspace orchestrator[\s\S]*be kind/);
  // A plain chat keeps the user's full setup.
  const chat = createSession('P', 'Chat', { integration: 'claude-code' });
  addMessage(chat.id, 'args');
  args = await argsOf(chat.id);
  assert.equal(flag(args, '--settings'), undefined);
  assert.equal(flag(args, '--setting-sources'), undefined);
});

test('pause interrupts a task and keeps its conversation; resume continues it and flags calls already run', async () => {
  const t = task('slow work');
  const run = runTurn(t.id);
  await until(() => sessionWorking(t.id) && readEvents(t.id).some((e) => e.type === 'init'));
  pauseTask(t.id);
  await run;
  assert.equal(status(t.id), 'paused');
  assert.equal(last(t.id).reason, 'paused');
  assert.equal(loadSession(t.id).vendorSessionId, 'fake-session');
  assert.throws(() => pauseTask(t.id), /not running/);
  resumeTask(t.id);
  await runTurn(t.id);
  assert.equal(status(t.id), 'completed');
  const ts = turns(readEvents(t.id), false);
  ts[0]!.activity.push({ id: 'x', label: 'Bash ls', done: true, fp: 'f1' });
  assert.equal(repeatsFor(ts).get('f1'), 'step 1: Bash ls');
});

test('reply_task queues for a running task of this chat; a finished one gets a new task based on it', async () => {
  const chat = createSession('P', 'Orchestration', { integration: 'claude-code' });
  addMessage(chat.id, 'go');
  const t = startFromSession(chat.id, { goal: 'first delay', role: 'Implementation' });
  assert.equal(t.permissionMode, 'acceptEdits'); // a chat's tasks edit without asking unless it picks a mode
  startPendingTasks(chat.id);
  await until(() => sessionWorking(t.id));
  assert.throws(() => replyFromSession(chat.id, task('other').id, 'x'), /Unknown task in this chat/);
  replyFromSession(chat.id, t.id, 'also this');
  replyFromSession(chat.id, t.id, 'and that');
  await until(() => turns(readEvents(t.id), turnRunning(t.id)).length === 2 && status(t.id) === 'completed');
  assert.equal(turns(readEvents(t.id), false)[1]!.user, 'also this\n\nand that');
  assert.throws(() => replyFromSession(chat.id, t.id, 'more'), /is completed; start a new task with basedOn/);
  assert.equal(renameTask(chat.id, t.id, '  New name ').title, 'New name');
  assert.throws(() => renameTask(chat.id, task('other').id, 'x'), /Unknown task in this chat/);
  const next = startFromSession(chat.id, { goal: 'same again', role: 'Implementation', basedOn: t.id });
  assert.match(turns(readEvents(next.id), false)[0]!.user, /^same again\n\nContext from an earlier related task .*completed[\s\S]*first delay[\s\S]*turn 2/);
  saveSession({ ...loadSession(chat.id), taskMode: '' });
  assert.equal(startFromSession(chat.id, { goal: 'x', role: 'Implementation' }).permissionMode, undefined);
});

test('ui API: a chat cap is set and cleared, pause and resume a task, a changed agent is marked as overridden', async () => {
  const server = serve(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const chat = await (await post('/api/sessions', { projectId: 'P', role: 'Orchestration', taskCap: 5000 })).json();
    assert.equal(loadSession(chat.id).taskCap, 5000);
    assert.equal((await post(`/api/sessions/${chat.id}/cap`, { taskCap: 0 })).status, 400);
    await post(`/api/sessions/${chat.id}/cap`, { taskCap: null });
    assert.equal(loadSession(chat.id).taskCap, undefined);
    await post(`/api/sessions/${chat.id}/mode`, { taskMode: 'auto' });
    assert.equal(loadSession(chat.id).taskMode, 'auto');
    assert.equal((await post(`/api/sessions/${chat.id}/mode`, { taskMode: 5 })).status, 400);
    const t = task('slow work');
    startTurn(t.id);
    await until(() => sessionWorking(t.id) && readEvents(t.id).some((e) => e.type === 'init'));
    assert.equal((await post(`/api/tasks/${t.id}/pause`, {})).status, 200);
    await until(() => status(t.id) === 'paused');
    assert.equal((await post(`/api/tasks/${t.id}/pause`, {})).status, 400);
    assert.equal((await post(`/api/sessions/${t.id}/config`, { effort: sessionAgent('claude-code').catalog().models[0]!.efforts[0] })).status, 200);
    assert.equal(loadSession(t.id).task!.overridden, true);
    assert.equal((await post(`/api/tasks/${t.id}/resume`, {})).status, 200);
    await until(() => status(t.id) === 'completed');
    const { runs } = await (await fetch(`${base}/api/tasks/${t.id}`)).json();
    assert.deepEqual(runs.map((r: { state: string; paused: number }) => [r.state, r.paused]), [['done', 1]]); // Resume joins the paused run
  } finally {
    server.close();
  }
});

test('a reply typed under a task goes to it directly; the chat records it and its agent hears it next', async () => {
  const server = serve(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const chat = createSession('P', 'Orchestration', { integration: 'claude-code' });
    addMessage(chat.id, 'go');
    emit(chat.id, 1, { type: 'done' });
    const t = startFromSession(chat.id, { goal: 'first', role: 'Implementation' });
    await runTurn(t.id);
    const r = await fetch(`${base}/api/tasks/${t.id}/reply`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ text: 'make it red' }) });
    assert.equal(r.status, 200);
    assert.equal(turns(readEvents(t.id), true).at(-1)!.user, 'make it red');
    assert.deepEqual(turns(readEvents(chat.id), false)[0]!.relays, [{ taskId: t.id, text: 'make it red' }]);
    addMessage(chat.id, 'what now?');
    const { turnPrompt } = await import('../src/sessions.ts');
    assert.equal(turnPrompt(turns(readEvents(chat.id), true)), `[Since your last reply the user wrote directly to task ${t.id}: "make it red"]\n\nwhat now?`);
  } finally {
    server.close();
  }
});

test('a cached log picks up appended events, waits for a half-written line and survives a rewrite', async () => {
  const { appendFileSync, writeFileSync } = await import('node:fs');
  const { sessionFile } = await import('../src/sessions.ts');
  const s = createSession('P', 'Chat', { integration: 'claude-code' });
  addMessage(s.id, 'one');
  assert.equal(readEvents(s.id).length, 1);
  emit(s.id, 1, { type: 'text', text: 'hi' });
  assert.equal(readEvents(s.id).length, 2);
  const path = sessionFile(s.id, '.jsonl');
  appendFileSync(path, '{"at":"x","turn":1,"type":"do');
  assert.equal(readEvents(s.id).length, 2);
  appendFileSync(path, 'ne"}\n');
  assert.equal(readEvents(s.id).at(-1)!.type, 'done');
  writeFileSync(path, '{"at":"x","turn":1,"type":"user","text":"new"}\n');
  assert.deepEqual(readEvents(s.id).map((e) => e.type), ['user']);
});

test('the page script parses', async () => {
  const { readFileSync } = await import('node:fs');
  const { Script } = await import('node:vm');
  const html = readFileSync(new URL('../src/ui.html', import.meta.url), 'utf8');
  for (const [, js] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(js!);
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

test('tokens count at real cost: cache reads at a tenth, cache writes at a quarter more', () => {
  assert.equal(used({ inputTokens: 100_000, cachedInputTokens: 90_000, cacheWriteTokens: 8_000, outputTokens: 500 }), 2_000 + 500 + 9_000 + 10_000);
  assert.equal(used({ inputTokens: 10, outputTokens: 2 }), 12);
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
    assert.equal(detail.task.goal, 'g');
    // fetch cannot override Host, which is what DNS rebinding sends
    const rebound = await new Promise<number>((r) => get({ port, path: '/api/tasks', headers: { host: `evil.test:${port}` } }, (res) => r(res.statusCode!)).end());
    assert.equal(rebound, 403);
    assert.equal((await post(`/api/tasks/${t.id}/cancel`, { 'content-type': 'application/json' })).status, 403);
    assert.equal((await post(`/api/tasks/${t.id}/reply`, { origin: base, 'content-type': 'text/plain' })).status, 415);
    assert.equal((await post('/api/tasks', json, JSON.stringify({ projectId: 'P', goal: 'x', role: 'Implementation', budget: 10 }))).status, 404); // tasks start from a chat (ADR 0010)
    assert.equal((await (await post(`/api/tasks/${t.id}/cancel`, json)).json()).status, 'cancelled');
    assert.equal((await post(`/api/tasks/${t.id}/reply`, json, JSON.stringify({ text: 'again' }))).status, 400);
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
