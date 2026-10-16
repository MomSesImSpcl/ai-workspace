import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeniedError, readFile, writeFile, type Scope } from '../src/broker.ts';
import { createTask, loadTask, runTask, saveTask, type AgentAdapter } from '../src/runtime.ts';
import { adapterFor, assignmentFor, getRoles, setRole } from '../src/roles.ts';
import { parseResult } from '../src/adapters/claude-code.ts';
import { parseEvents } from '../src/adapters/codex.ts';
import { delegate } from '../src/delegate.ts';
import { addProject } from '../src/store.ts';

let root = '';
beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'ws-test-'));
  process.env.AI_WORKSPACE_HOME = join(dir, 'home');
  root = join(dir, 'project');
  mkdirSync(root);
  writeFileSync(join(root, 'a.txt'), 'hello');
  writeFileSync(join(dir, 'secret.txt'), 'secret');
});

const auditLines = () => readFileSync(join(process.env.AI_WORKSPACE_HOME!, 'audit.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const scope = (write: boolean): Scope => ({ taskId: 't1', root, write });

test('broker reads inside the project and denies paths outside it, with audit', () => {
  assert.equal(readFile(scope(false), 'a.txt'), 'hello');
  assert.throws(() => readFile(scope(true), '../secret.txt'), DeniedError);
  assert.throws(() => readFile(scope(true), join(root, '..', 'secret.txt')), DeniedError);
  const denied = auditLines().filter((e) => !e.allowed);
  assert.equal(denied.length, 2);
  assert.equal(denied[0].reason, 'outside project');
});

test('broker denies writes without a write grant and audits them', () => {
  assert.throws(() => writeFile(scope(false), 'b.txt', 'x'), /write not granted/);
  assert.equal(existsSync(join(root, 'b.txt')), false);
  writeFile(scope(true), 'sub/b.txt', 'x');
  assert.equal(readFileSync(join(root, 'sub/b.txt'), 'utf8'), 'x');
  assert.deepEqual(auditLines().map((e) => e.allowed), [false, true]);
});

const fields = { projectId: 'p', goal: 'g', role: 'Implementation', integration: 'fake', write: false };
const steps = (n: number, tokensPerStep: number): AgentAdapter & { calls: number } => {
  const a = { calls: 0, async step() { a.calls++; return { done: a.calls >= n, text: `step ${a.calls}`, usage: { inputTokens: tokensPerStep, outputTokens: 0 } }; } };
  return a;
};

test('task pauses when the token budget is reached and resumes with a larger budget', async () => {
  const task = createTask({ ...fields, tokenBudget: 250 });
  const adapter = steps(5, 100);
  const paused = await runTask(task.id, adapter, root);
  assert.equal(paused.status, 'paused');
  assert.match(paused.reason!, /token budget/);
  assert.equal(adapter.calls, 3);
  const t = loadTask(task.id);
  t.tokenBudget = 10_000;
  saveTask(t);
  const done = await runTask(task.id, adapter, root);
  assert.equal(done.status, 'completed');
  assert.equal(done.steps, 5);
  assert.equal(done.usage.inputTokens, 500);
});

test('task interrupted mid-step resumes from its last committed checkpoint', async () => {
  const task = createTask({ ...fields, tokenBudget: 10_000 });
  // Simulate a killed process: two steps committed, then status left as running.
  Object.assign(task, { status: 'running', steps: 2, usage: { inputTokens: 200, outputTokens: 0 } });
  saveTask(task);
  const adapter = steps(1, 100);
  const done = await runTask(task.id, adapter, root);
  assert.equal(done.status, 'completed');
  assert.equal(done.steps, 3);
  assert.equal(adapter.calls, 1);
});

test('adapter errors fail the task with a reason', async () => {
  const task = createTask({ ...fields, tokenBudget: 10_000 });
  const done = await runTask(task.id, { async step() { throw new Error('boom'); } }, root);
  assert.equal(done.status, 'failed');
  assert.equal(done.reason, 'boom');
});

test('roles keep independent assignments; unknown integrations fail explicitly', () => {
  assert.equal(assignmentFor('Implementation').integration, 'claude-code');
  setRole('Orchestration', { integration: 'not-built' });
  const roles = getRoles();
  assert.equal(roles.Orchestration.integration, 'not-built');
  assert.equal(roles.Implementation.integration, 'claude-code');
  assert.equal(roles.ArchitectureReasoning.integration, 'manual-browser');
  assert.throws(() => adapterFor('not-built'), /no runnable adapter/);
});

test('claude-code result parsing maps success, max-turns and errors', () => {
  const base = { session_id: 's', usage: { input_tokens: 10, cache_read_input_tokens: 5, output_tokens: 3 }, total_cost_usd: 0.01 };
  const ok = parseResult(JSON.stringify({ ...base, subtype: 'success', is_error: false, result: 'hi' }));
  assert.deepEqual([ok.done, ok.text, ok.usage.inputTokens, ok.usage.outputTokens, ok.adapterState], [true, 'hi', 15, 3, { sessionId: 's' }]);
  const more = parseResult(JSON.stringify({ ...base, subtype: 'error_max_turns', is_error: true }));
  assert.deepEqual([more.done, more.error], [false, undefined]);
  const bad = parseResult(JSON.stringify({ ...base, subtype: 'error_during_execution', is_error: true }));
  assert.equal(bad.error, 'error_during_execution');
});

test('codex event parsing maps completed turns, usage and failures', () => {
  const ok = parseEvents([
    '{"type":"thread.started","thread_id":"t1"}',
    '{"type":"item.completed","item":{"type":"error","message":"warning"}}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"done"}}',
    '{"type":"turn.completed","usage":{"input_tokens":100,"cached_input_tokens":60,"output_tokens":7}}',
  ].join('\n'));
  assert.deepEqual([ok.done, ok.text, ok.usage.inputTokens, ok.usage.outputTokens, ok.adapterState], [true, 'done', 100, 7, { threadId: 't1' }]);
  const failed = parseEvents('{"type":"turn.failed","error":{"message":"usage limit"}}');
  assert.deepEqual([failed.done, failed.error], [false, 'usage limit']);
  assert.match(parseEvents('').error!, /no completed turn/);
});

test('delegate runs a child with inherited write grant and budget, charges the parent, and reuses it', async () => {
  addProject({ id: 'p', root });
  const parent = createTask({ ...fields, write: false, tokenBudget: 1000 });
  const adapter = steps(1, 300);
  const lookup = () => adapter;
  const child = await delegate(parent.id, 'sub goal', 'Implementation', lookup);
  assert.deepEqual([child.status, child.write, child.tokenBudget, child.parentId], ['completed', false, 1000, parent.id]);
  assert.equal(loadTask(parent.id).usage.inputTokens, 300);
  const again = await delegate(parent.id, 'sub goal', 'Implementation', lookup);
  assert.equal(again.id, child.id);
  assert.equal(adapter.calls, 1);
  await assert.rejects(delegate(child.id, 'nested', 'Implementation', lookup), /depth limit/);
});
