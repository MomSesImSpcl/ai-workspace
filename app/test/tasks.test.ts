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
import { addMessage, createSession, emit, isSetupContinue, ORCHESTRATION, ORCHESTRATOR_NOTE, setupContinue, fingerprint, listSessions, loadSession, readEvents, repeatsFor, saveSession, used, sessionWorking, turnRunning, turns, type AgentProcess, type SessionAgent } from '../src/sessions.ts';
import { stateOf } from '../src/setup.ts';
import { cancelTask, childrenOf, createTask, listTasks, migrateTasks, pauseTask, renameTask, replyFromSession, resumeTask, startFromSession, startPendingTasks, taskStatus, taskUsed } from '../src/tasks.ts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { hostSession, runTurn, sessionAgent, startTurn } from '../src/turn.ts';
import { serve } from '../src/ui.ts';
import { home, registerProject } from '../src/store.ts';

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
const fake = (turn: AgentProcess['turn']): Record<string, SessionAgent> => ({ 'claude-code': { capabilities: { approvalTool: false, refusalText: false }, open: () => ({ turn, close() {} }), permissions: () => ({ line: 'fake' }), catalog: () => ({ models: [] }), inventory: async () => [] } });

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
  await until(() => last(t.id).approvals.length === 1, 30_000); // starting the fake app-server is slow on busy Windows runners
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

test('a chat starts a task: the task records the chat, which shows it with its approvals and result, and takes replies', async () => {
  const chat = createSession('P', 'Chat', { integration: 'claude-code' });
  addMessage(chat.id, 'please start one');
  const t = startFromSession(chat.id, { goal: 'background goal', role: 'Implementation', tokenBudget: 5000, setup: ['tool:Read'] });
  assert.equal(t.task!.sessionId, chat.id);
  assert.deepEqual(last(chat.id).tasks, [t.id]);
  startPendingTasks(chat.id); // the chat's runner does this while its turn runs
  await until(() => status(t.id) === 'completed');
  assert.throws(() => startFromSession(t.id, { goal: 'x', role: 'Implementation', tokenBudget: 10 }), /Tasks do not start tasks/);
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

test('the workspace MCP server offers start_task to a chat session, request_setup to a task and read_repo to both', async () => {
  const chat = createSession('P', 'Chat', { integration: 'claude-code' });
  const tools = async (id: string) => {
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../src/approval-server.ts', import.meta.url)), id], env: { ...process.env } as Record<string, string> }));
    try { return (await client.listTools()).tools.map((x) => x.name).sort(); } finally { await client.close(); }
  };
  assert.deepEqual(await tools(chat.id), ['approve', 'list_agents', 'read_repo', 'rename_task', 'reply_task', 'start_task', 'task_status']);
  assert.deepEqual(await tools(task('t').id), ['approve', 'read_repo', 'request_setup']); // no delegate: tasks do not start tasks (ADR 0024)
});

test('the orchestrator role cannot edit or run commands with either agent; a task of the same agent can', async () => {
  const orch = createSession('P', 'Orchestration', { integration: 'claude-code' });
  addMessage(orch.id, 'args');
  await runTurn(orch.id);
  const args = JSON.parse(last(orch.id).text) as string[];
  assert.match(args[args.indexOf('--disallowedTools') + 1]!, /Bash,Edit,Write/);
  assert.match(args[args.indexOf('--append-system-prompt') + 1]!, /workspace orchestrator[\s\S]*Workspace storage/);
  assert.equal(args[args.indexOf('--add-dir') + 1], home()); // reads storage without a card
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
  // Every run gets the write guard for the running app's checkout and storage (selfdev-002).
  // Asked over HTTP from the process that runs the agent, with the run's own token (no process per tool call).
  const pre = JSON.parse(targs[targs.indexOf('--settings') + 1]!).hooks.PreToolUse as { matcher: string; hooks: { type: string; url: string; headers: Record<string, string> }[] }[];
  const guard = pre.find((h) => h.matcher.includes('Bash'))!.hooks[0]!;
  assert.equal(guard.type, 'http');
  assert.match(guard.url, /^http:\/\/127\.0\.0\.1:\d+\/guard$/);
  assert.match(guard.headers['x-aiws-token']!, /^[0-9a-f]{48}$/);
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

test('list_agents distinguishes setup switches from capabilities; implementation defaults and user overrides survive', async () => {
  const { saveInventory, setItemState, setupStatus } = await import('../src/setup.ts');
  const { requestSetup } = await import('../src/tasks.ts');
  for (const agent of ['claude-code', 'codex']) saveInventory(agent, await sessionAgent(agent).inventory(root));
  setRole('Implementation', { integration: 'codex', effort: 'medium' });
  const chat = createSession('P', ORCHESTRATION, { integration: 'claude-code' });
  addMessage(chat.id, 'fix it');
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../src/approval-server.ts', import.meta.url)), chat.id], env: { ...process.env } as Record<string, string> }));
  try {
    const result = await client.callTool({ name: 'list_agents', arguments: {} });
    const catalog = JSON.parse((result.content as { text: string }[])[0]!.text);
    assert.equal(catalog.roles.Implementation.integration, 'codex');
    assert.ok(catalog.setup['claude-code'].some((i: { id: string }) => i.id === 'tool:Bash'));
    assert.ok(!catalog.setup.codex.some((i: { id: string }) => i.id.startsWith('tool:')));
    assert.deepEqual(catalog.setupStatus.codex, { requiresBuiltInTool: false, alwaysOn: ['feature:shell_tool'] });
    assert.equal(catalog.setupStatus['claude-code'].requiresBuiltInTool, true);
    // Only prompt is picked: the Codex shell is already enabled, no invented tool:* id is necessary.
    const started = await client.callTool({ name: 'start_task', arguments: { goal: 'args', setup: ['prompt'], effort: 'medium' } });
    assert.ok(!started.isError);
    const t = listTasks()[0]!;
    assert.deepEqual([t.integration, t.model, t.effort], ['codex', undefined, 'medium']);
    await runTurn(t.id);
    assert.equal(JSON.parse(last(t.id).text).config['features.shell_tool'], undefined); // not switched off
    assert.throws(() => requestSetup(t.id, ['tool:Bash'], 'run tests'), /Unknown setup items/);
    setItemState('Implementation', 'codex', 'feature:shell_tool', 'decide');
    assert.deepEqual(setupStatus('codex').alwaysOn, []);
    assert.match(requestSetup(t.id, ['feature:shell_tool'], 'run tests'), /End your turn/);
    assert.equal(loadSession(t.id).integration, 'codex');
    setItemState('Implementation', 'codex', 'feature:shell_tool', 'off');
    assert.throws(() => requestSetup(t.id, ['feature:shell_tool'], 'run tests'), /switched these off/);
    assert.equal(loadSession(t.id).integration, 'codex');
    // A saved model is inherited; changing the role is observed even in this existing MCP server.
    setRole('Implementation', { integration: 'claude-code', model: 'sonnet', effort: 'high' });
    const inherited = startFromSession(chat.id, { goal: 'fix', role: 'Implementation', setup: ['tool:Edit'] });
    assert.deepEqual([inherited.integration, inherited.model], ['claude-code', 'sonnet']);
    const explicit = startFromSession(chat.id, { goal: 'user chose Codex', role: 'Implementation', agent: 'codex', model: '', effort: 'medium', setup: ['prompt'] });
    assert.deepEqual([explicit.integration, explicit.model], ['codex', undefined]);
    const updated = await client.callTool({ name: 'list_agents', arguments: {} });
    assert.equal(JSON.parse((updated.content as { text: string }[])[0]!.text).roles.Implementation.model, 'sonnet');
  } finally { await client.close(); }
});

test('orchestrator instructions bind implementation to the configured role and make tool selection agent-specific', () => {
  assert.match(ORCHESTRATOR_NOTE, /omit agent and model in start_task to inherit them unless the user explicitly overrides them/);
  assert.match(ORCHESTRATOR_NOTE, /Never switch integration because another agent exposes more setup items or tools/);
  assert.match(ORCHESTRATOR_NOTE, /When requiresBuiltInTool is true/);
  assert.match(ORCHESTRATOR_NOTE, /Codex has no tool:\* setup ids; its shell is feature:shell_tool/);
  assert.match(ORCHESTRATOR_NOTE, /request_setup and continue on the same agent/);
  assert.match(ORCHESTRATOR_NOTE, /report a blocker rather than switch agents or bypass permissions/);
});

test('orchestrator chats and tasks load only the chosen setup items, switched for the one run (orchestrator-005)', async () => {
  const { setGlobalRules, setItemState, getAgentSetup } = await import('../src/setup.ts');
  const { setWorkspaceRoot } = await import('../src/store.ts');
  writeFileSync(join(root, '..', 'AGENTS.md'), 'Workspace rule: be kind.');
  setWorkspaceRoot(join(root, '..'));
  // A standalone skill that is a copy of the plugin's own skill (same SKILL.md).
  const pluginDir = join(root, '..', 'demo-plugin');
  for (const d of [join(pluginDir, 'skills', 'tidy'), join(process.env.CLAUDE_CONFIG_DIR!, 'skills', 'tidy-copy'), join(process.env.CLAUDE_CONFIG_DIR!, 'skills', 'own')]) { mkdirSync(d, { recursive: true }); writeFileSync(join(d, 'SKILL.md'), d.endsWith('own') ? 'mine' : 'tidy up'); }
  process.env.FAKE_PLUGIN_PATH = pluginDir;
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
  assert.ok(!args.includes('--disable-slash-commands')); // global rules off: standalone skills do not load anyway
  assert.deepEqual(getAgentSetup().inventory!['claude-code']!.find((i) => i.kind === 'skills')!.parts!.map((p) => p.name).sort(), ['own', "tidy-copy (copy of the demo plugin's skill)"]);
  assert.match(flag(args, '--append-system-prompt')!, /workspace's own rules[\s\S]*be kind/);
  assert.deepEqual(getAgentSetup().inventory!['claude-code']!.slice(0, 3).map((i) => i.id), ['plugin:demo@market', 'mcp:claude.ai github', 'skills']);
  // A task: an item the orchestrator decides loads only when picked; an always-on item always; global rules per role.
  setItemState('Implementation', 'claude-code', 'plugin:demo@market', 'on');
  setGlobalRules('Implementation', true);
  const plain = createTask({ projectId: 'P', goal: 'args', role: 'Implementation', setup: ['tool:Read'] });
  args = await argsOf(plain.id);
  assert.match(flag(args, '--disallowedTools')!, /mcp__claude_ai_github/);
  assert.equal(flag(args, '--tools'), 'Read'); // only the picked built-in tool
  assert.match(flag(args, '--system-prompt')!, /^You are a coding agent/); // its own system prompt is an item too
  assert.equal(JSON.parse(flag(args, '--settings')!).enabledPlugins, undefined);
  assert.equal(flag(args, '--setting-sources'), undefined);
  assert.ok(!args.includes('--disable-slash-commands')); // the plugin of this run keeps its skills
  setItemState('Implementation', 'claude-code', 'plugin:demo@market', 'off');
  assert.ok((await argsOf(createTask({ projectId: 'P', goal: 'args', role: 'Implementation', setup: ['tool:Read'] }).id)).includes('--disable-slash-commands'));
  setItemState('Implementation', 'claude-code', 'plugin:demo@market', 'on');
  const picked = createTask({ projectId: 'P', goal: 'args', role: 'Implementation', setup: ['mcp:claude.ai github', 'tool:Read'] });
  args = await argsOf(picked.id);
  assert.equal(flag(args, '--disallowedTools'), undefined);
  assert.ok(JSON.parse(flag(args, '--settings')!).hooks.PreToolUse.length); // the workspace's repeat hook stays
  assert.throws(() => setItemState('Chat', 'claude-code', 'x', 'on'), /Unknown role/);
  // A chat's task with no built-in tool is refused; a running task asks for what it misses and continues with it.
  const { startFromSession: start, requestSetup } = await import('../src/tasks.ts');
  assert.throws(() => start(orch.id, { goal: 'x', role: 'Implementation' }), /No built-in tool picked/);
  const lacking = start(orch.id, { goal: 'args', role: 'Implementation', setup: ['tool:Read'] });
  await runTurn(lacking.id);
  assert.throws(() => requestSetup(lacking.id, ['tool:Nope'], 'x'), /Unknown setup items/);
  setItemState('Implementation', 'claude-code', 'tool:Bash', 'off');
  assert.throws(() => requestSetup(lacking.id, ['tool:Bash'], 'x'), /switched these off/);
  assert.match(requestSetup(lacking.id, ['tool:Edit'], 'needs to change a file'), /End your turn/);
  assert.ok(readEvents(lacking.id).some((e) => e.type === 'notice' && /Asked for Edit: needs to change a file/.test(e.text)));
  assert.ok(readEvents(orch.id).some((e) => e.type === 'relay' && /Asked for Edit/.test(e.text))); // shown in the chat too
  await runTurn(lacking.id);
  assert.match(turns(readEvents(lacking.id), false).at(-1)!.user, /The workspace enabled tool:Edit/);
  assert.match(last(lacking.id).text, /^turn 1 /); // a new process, started with the added item
  assert.deepEqual(loadSession(lacking.id).task!.setup, ['tool:Read', 'tool:Edit']);
  // Codex: plugins off per turn, MCP servers, apps, standalone skills and hooks off in the thread config.
  const cx = createSession('P', 'Orchestration', { integration: 'codex' });
  addMessage(cx.id, 'args');
  await runTurn(cx.id);
  const sent = JSON.parse(last(cx.id).text) as { config: Record<string, unknown>; developerInstructions: string; disabledPluginIds: string[]; aiws: string };
  assert.equal(sent.aiws, 'ready'); // the first turn waited for the workspace tools
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
  // Its settings hold only the write guard (selfdev-002); Claude Code adds hooks from every source, so the user's stay.
  assert.deepEqual(Object.keys(JSON.parse(flag(args, '--settings')!)), ['hooks']);
  assert.match(JSON.stringify(JSON.parse(flag(args, '--settings')!).hooks), /127\.0\.0\.1:\d+\/guard/);
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
  const t = startFromSession(chat.id, { goal: 'first delay', role: 'Implementation', setup: ['tool:Read'] });
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
  assert.equal(startFromSession(chat.id, { goal: 'x', role: 'Implementation', setup: ['tool:Read'] }).permissionMode, undefined);
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
    const t = startFromSession(chat.id, { goal: 'first', role: 'Implementation', setup: ['tool:Read'] });
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
  assert.deepEqual(Object.keys(roles), ['Chat', 'Orchestration', 'Implementation']); // the order Settings shows
  assert.throws(() => setRole('ArchitectureReasoning', { integration: 'claude-code' }), /Unknown role/);
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
    const roles = await (await post('/api/roles', json, JSON.stringify({ role: 'Implementation', integration: 'codex', model: '', effort: '' }))).json();
    assert.equal(roles.Implementation.integration, 'codex');
    assert.equal(roles.Implementation.model, undefined);
    const set = (body: unknown) => post('/api/roles', json, JSON.stringify(body)).then((r) => r.json());
    await set({ role: 'Chat', integration: 'claude-code', model: 'opus', effort: 'high' });
    await set({ role: 'Chat', integration: 'codex', restore: true });
    const back = (await set({ role: 'Chat', integration: 'claude-code', restore: true })).Chat;
    assert.deepEqual([back.integration, back.model, back.effort], ['claude-code', 'opus', 'high']); // the role's last choices for that agent
    const s = loadSession(t.id);
    s.title = 'renamed';
    saveSession(s);
  } finally {
    server.close();
  }
});

test('an MCP server command names its program file only for an existing absolute path, spaces included', async () => {
  const { commandFile } = await import('../src/setup.ts');
  assert.equal(commandFile(`${process.execPath} --flag`), process.execPath);
  assert.equal(commandFile(`"${process.execPath}" --flag`), process.execPath);
  assert.equal(commandFile('npx some-server'), undefined);
  assert.equal(commandFile('https://example.test/mcp'), undefined);
});

test("Codex's shell is on by default, for tasks and the orchestrator; a set state wins", () => {
  assert.equal(stateOf({}, 'Implementation', 'codex', 'feature:shell_tool'), 'on');
  assert.equal(stateOf({}, 'Implementation', 'codex', 'feature:memories'), 'decide');
  assert.equal(stateOf({}, ORCHESTRATION, 'codex', 'feature:shell_tool'), 'on');
  assert.equal(stateOf({}, ORCHESTRATION, 'codex', 'feature:memories'), 'off');
  assert.equal(stateOf({ states: { Implementation: { codex: { 'feature:shell_tool': 'off' } } } }, 'Implementation', 'codex', 'feature:shell_tool'), 'off');
});

test('the continue after request_setup is recognised, a user reply is not', () => {
  assert.equal(isSetupContinue(setupContinue(['feature:shell_tool', 'tool:Bash'])), true);
  assert.equal(isSetupContinue('Please continue the task.'), false);
});

test('both agents receive the same instructions in every role (ADR 0023)', async () => {
  const sent = async (agent: string, role: string) => {
    const s = role === 'Implementation' ? createTask({ projectId: 'P', goal: 'args', role, agent }) : createSession('P', role, { integration: agent });
    if (!s.task) addMessage(s.id, 'args');
    await runTurn(s.id);
    if (agent === 'codex') return (JSON.parse(last(s.id).text) as { developerInstructions: string }).developerInstructions;
    const args = JSON.parse(last(s.id).text) as string[];
    return args[args.indexOf('--append-system-prompt') + 1];
  };
  for (const role of ['Chat', 'Orchestration', 'Implementation']) {
    const claude = await sent('claude-code', role);
    assert.match(claude!, /^AI Workspace (session|task): effort level/, role);
    assert.equal(await sent('codex', role), claude, role);
  }
});
