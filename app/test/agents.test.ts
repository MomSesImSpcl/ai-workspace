// The shared agent interface (ADR 0023): every agent implements all of it and reports every capability, and an
// instruction that needs a capability goes only to agents that report it. That every agent gets the same
// instructions is checked in app/test/tasks.test.ts ("both agents receive the same instructions").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITIES } from '../src/sessions.ts';
import { sessionAgents } from '../src/turn.ts';
import { CATALOG, withCapabilities } from '../src/instructions.ts';

test('every agent implements the whole interface and reports every capability', () => {
  assert.ok(Object.keys(sessionAgents).length >= 2);
  for (const [name, agent] of Object.entries(sessionAgents)) {
    for (const f of ['open', 'permissions', 'catalog', 'inventory', 'installed'] as const) assert.equal(typeof agent[f], 'function', `${name}.${f}`);
    assert.deepEqual(Object.keys(agent.capabilities).sort(), Object.keys(CAPABILITIES).sort(), `${name}: capabilities`);
    for (const v of Object.values(agent.capabilities)) assert.equal(typeof v, 'boolean', name);
  }
});

test('an instruction that needs a capability goes only to agents that report it', () => {
  const agents = { 'claude-code': { capabilities: { approvalTool: true, refusalText: false }, installed: () => true }, codex: { capabilities: { approvalTool: false, refusalText: true }, installed: () => true } };
  const by = (id: string) => withCapabilities(agents).find((e) => e.id === id)!;
  assert.deepEqual(by('tool.approve').applies.Chat, ['claude-code']);
  assert.deepEqual(by('refusal.guard').applies.Chat, ['codex']);
  assert.deepEqual(by('note.task').applies.Implementer, ['claude-code', 'codex']); // needs nothing: every agent
  for (const e of CATALOG.filter((x) => x.needs)) for (const list of Object.values(e.applies)) assert.deepEqual(list, ['claude-code', 'codex'], `${e.id}: written for every agent`);
});

test('without an installed agent the roles have none and starting is refused (onboarding-006)', async () => {
  const { mkdtempSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { getRoles } = await import('../src/roles.ts');
  const { agentChoice, installedAgents } = await import('../src/turn.ts');
  const saved = { home: process.env.AI_WORKSPACE_HOME, claude: process.env.CLAUDE_BIN, codex: process.env.CODEX_BIN, path: process.env.PATH };
  const dir = mkdtempSync(join(tmpdir(), 'aiws-noagent-'));
  Object.assign(process.env, { AI_WORKSPACE_HOME: dir, CLAUDE_BIN: join(dir, 'none-claude'), CODEX_BIN: join(dir, 'none-codex'), PATH: dir });
  try {
    assert.deepEqual(installedAgents(), []);
    for (const a of Object.values(getRoles())) assert.equal(a.integration, '');
    assert.throws(() => agentChoice({}, getRoles().Chat!), /No agent is set up/);
    process.env.CODEX_BIN = process.execPath; // an existing program counts as installed
    assert.deepEqual(installedAgents(), ['codex']);
    for (const a of Object.values(getRoles())) assert.equal(a.integration, 'codex');
  } finally {
    for (const [k, v] of Object.entries({ AI_WORKSPACE_HOME: saved.home, CLAUDE_BIN: saved.claude, CODEX_BIN: saved.codex, PATH: saved.path })) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

test('both adapters name the workspace tool an activity calls (agent-interface-008)', async () => {
  const { sessionEvents } = await import('../src/adapters/claude-code.ts');
  const { codexActivity } = await import('../src/adapters/codex.ts');
  const line = (name: string) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'u1', name, input: {} }] } });
  assert.equal((sessionEvents(line('mcp__aiws__request_setup'), '/').events[0] as { workspaceTool?: string }).workspaceTool, 'request_setup');
  assert.equal((sessionEvents(line('Bash'), '/').events[0] as { workspaceTool?: string }).workspaceTool, undefined);
  assert.equal(codexActivity({ type: 'mcpToolCall', id: 'i1', server: 'aiws', tool: 'request_setup' } as never)?.workspaceTool, 'request_setup');
  assert.equal(codexActivity({ type: 'mcpToolCall', id: 'i1', server: 'other', tool: 'x' } as never)?.workspaceTool, undefined);
});
