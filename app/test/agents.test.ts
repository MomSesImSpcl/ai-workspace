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
    for (const f of ['open', 'permissions', 'catalog', 'inventory'] as const) assert.equal(typeof agent[f], 'function', `${name}.${f}`);
    assert.deepEqual(Object.keys(agent.capabilities).sort(), Object.keys(CAPABILITIES).sort(), `${name}: capabilities`);
    for (const v of Object.values(agent.capabilities)) assert.equal(typeof v, 'boolean', name);
  }
});

test('an instruction that needs a capability goes only to agents that report it', () => {
  const agents = { 'claude-code': { capabilities: { approvalTool: true, refusalText: false } }, codex: { capabilities: { approvalTool: false, refusalText: true } } };
  const by = (id: string) => withCapabilities(agents).find((e) => e.id === id)!;
  assert.deepEqual(by('reply.approve').applies.Chat, ['claude-code']);
  assert.deepEqual(by('guard.notice').applies.Chat, ['codex']);
  assert.deepEqual(by('session-note').applies.Chat, ['claude-code', 'codex']); // needs nothing: every agent
  for (const e of CATALOG.filter((x) => x.needs)) for (const list of Object.values(e.applies)) assert.deepEqual(list, ['claude-code', 'codex'], `${e.id}: written for every agent`);
});
