// The instruction registry and the Agent Instructions catalog (agent-interface-007, agent-instructions-001–005): every
// instruction is defined only in app/src/registry.ts and sent from the code, no copy of one is written anywhere else,
// workspace tools take their descriptions from it, placeholders are explained, and the tab exists only in a
// development environment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG, CATALOG_AGENTS, CATALOG_ROLES, GROUPS, instructionsAvailable } from '../src/instructions.ts';
import { agentText, isAgentText, REGISTRY } from '../src/registry.ts';
import { sessionAgents } from '../src/turn.ts';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith('.ts') ? [join(dir, d.name)] : []));
// Source text as a reader sees it, string escapes undone and comment lines dropped, for every file but the registry.
const code = files(src).filter((f) => !/[\\/]registry\.ts$/.test(f)).map((f) => ({ f, text: readFileSync(f, 'utf8').replace(/^\s*(\/\/|\/?\*).*$/gm, '').replace(/\\(['"`])/g, '$1') }));
// The fixed parts of a text: split at placeholders, line breaks and code quotes; short joins ignored.
const fragments = (text: string) => text.split(/\{\w+\}|\n|`/).map((f) => f.trim()).filter((f) => f.length >= 24);
const texts = (e: (typeof CATALOG)[number]) => [e.text, ...(e.variants ?? []).map((v) => v.text)];

test('every registry entry is sent from the code', () => {
  for (const e of CATALOG) assert.ok(e.sources.length, `${e.id} is defined but never sent`);
  // Each variant key is named next to its entry somewhere in the code.
  for (const [id, e] of Object.entries(REGISTRY)) for (const v of Object.keys((e as { variants?: object }).variants ?? {})) {
    assert.ok(code.some((c) => c.text.includes(`'${v}'`) && c.text.includes(`'${id}'`)), `${id}: variant ${v} is never sent`);
  }
});

test('no instruction is written outside the registry', () => {
  for (const e of CATALOG) for (const t of [...texts(e), ...(e.params ?? []).map((p) => p.text)]) for (const f of fragments(t)) {
    const hit = code.find((c) => c.text.includes(f));
    assert.ok(!hit, `${e.id}: "${f}" is also written in ${hit?.f}; send it with agentText instead`);
  }
});

test('workspace tools take their descriptions and parameter descriptions from the registry', () => {
  const server = readFileSync(join(src, 'approval-server.ts'), 'utf8');
  const names = [...server.matchAll(/registerTool\(\s*'(\w+)'/g)].map((m) => m[1]);
  assert.ok(names.length >= 9);
  assert.deepEqual(CATALOG.filter((e) => e.group === 'Workspace tools and their replies').map((e) => e.id.slice('tool.'.length)).sort(), [...names].sort());
  for (const m of server.matchAll(/description: ([^,\n]+)/g)) assert.match(m[1]!, /^agentText\('tool\./, `description not from the registry: ${m[1]}`);
  for (const m of server.matchAll(/\.describe\(([^)]*)\)/g)) assert.match(m[1]!, /^toolParam\('tool\./, `parameter description not from the registry: ${m[1]}`);
});

test('every instruction says why it is text and not code (agent-interface-008)', () => {
  for (const e of CATALOG) {
    assert.ok(e.textBecause.trim().length >= 20, `${e.id}: say why this cannot be code`);
    if (e.toCode !== undefined) assert.ok(e.toCode.trim(), `${e.id}: an empty code proposal`);
  }
});

test('agentText fills placeholders and refuses a missing value', () => {
  assert.equal(agentText('tool.rename_task', { task: 't1', title: 'Fix' }, 'ok'), 'task t1 is now titled "Fix"');
  assert.equal(agentText('tool.reply_task', { task: 't1', status: 'completed' }, 'finished'), 'Task t1 is completed; start a new task with basedOn: t1');
  assert.throws(() => agentText('tool.rename_task', { task: 't1' }, 'ok'), /no value for \{title\}/);
  assert.throws(() => agentText('tool.rename_task', { task: 't1', title: 'x' }, 'nope'), /no variant nope/);
  assert.equal(agentText('tool.rename_task', { task: '{title}', title: 'x' }, 'ok'), 'task {title} is now titled "x"'); // values are not filled again
  assert.ok(isAgentText('message.continue', agentText('message.continue', { ids: 'tool:Bash, mcp:x' }, 'setup'), 'setup'));
  assert.ok(!isAgentText('message.continue', 'Continue the task.', 'setup'));
});

test('every placeholder is explained, ids are unique, groups and roles are known', () => {
  assert.equal(new Set(CATALOG.map((e) => e.id)).size, CATALOG.length);
  for (const e of CATALOG) {
    assert.ok((GROUPS as readonly string[]).includes(e.group), e.id);
    for (const [role, agents] of Object.entries(e.applies)) {
      assert.ok((CATALOG_ROLES as readonly string[]).includes(role), `${e.id}: role ${role}`);
      for (const a of agents ?? []) assert.ok((CATALOG_AGENTS as readonly string[]).includes(a), `${e.id}: agent ${a}`);
    }
    for (const t of texts(e)) for (const [, name] of t.matchAll(/\{(\w+)\}/g)) assert.ok(e.placeholders?.[name!], `${e.id}: {${name}} is not explained`);
  }
});

test('the tab is available only when the app runs from a checkout', () => {
  assert.equal(instructionsAvailable(''), false);
  assert.equal(instructionsAvailable('/some/checkout'), true);
});

test('no workspace-authored text names an agent (agent-interface-003)', () => {
  // Agent ids filled into a placeholder are data; the fixed text must fit every agent.
  const names = /claude|codex|anthropic|openai/i;
  for (const e of CATALOG) for (const t of [...texts(e), ...(e.params ?? []).map((p) => p.text)]) assert.doesNotMatch(t, names, `${e.id} names an agent`);
});

test('workspace-authored entries go to every registered agent (agent-interface-001)', () => {
  assert.deepEqual([...CATALOG_AGENTS].sort(), Object.keys(sessionAgents).sort());
  for (const e of CATALOG) for (const [role, agents] of Object.entries(e.applies)) assert.deepEqual([...agents!].sort(), [...CATALOG_AGENTS].sort(), `${e.id} (${role})`);
});

test('the workspace tool server hands an agent only registry text or labelled data (agent-interface-007)', () => {
  const server = readFileSync(join(src, 'approval-server.ts'), 'utf8');
  // One place builds a tool result, and its type takes only AgentText or AgentData; other errors are framed by refusal.failed.
  assert.equal(server.match(/type: 'text' as const/g)?.length, 1);
  assert.match(server, /const answer = \(text: AgentText \| AgentData/);
  assert.doesNotMatch(server, /\(e as Error\)\.message \}\]/);
});
