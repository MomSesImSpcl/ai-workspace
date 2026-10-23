// The Agent Instructions catalog (agent-instructions-001–005): every copied text still matches the code that sends it,
// every workspace tool is listed, placeholders are explained, and the tab exists only in a development environment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CATALOG, CATALOG_AGENTS, CATALOG_ROLES, externalSources, GROUPS, instructionsAvailable } from '../src/instructions.ts';
import { GUARD_MARK } from '../src/worktrees.ts';

const repo = fileURLToPath(new URL('../../', import.meta.url));
// Source text as a reader sees it: string escapes undone and the block notice's mark filled in, so a copy can be found in it.
const source = (file: string) => readFileSync(repo + file, 'utf8').replace(/\\(['"`])/g, '$1').replaceAll('${GUARD_MARK}', GUARD_MARK);
// The fixed parts of a text: split at placeholders, line breaks and code quotes, short joins ignored.
const fragments = (text: string) => text.split(/\{\w+\}|\n|`/).map((f) => f.trim()).filter((f) => f.length >= 8);
const texts = (e: (typeof CATALOG)[number]) => [e.text, ...(e.variants ?? []).map((v) => v.text)];

test('every copied text is still in its source files', () => {
  for (const e of CATALOG.filter((x) => x.from === 'copy')) {
    const code = e.sources.map((s) => source(s.file)).join('\n');
    for (const t of texts(e)) for (const f of fragments(t)) assert.ok(code.includes(f), `${e.id}: "${f}" not found in ${e.sources.map((s) => s.file).join(', ')}`);
  }
});

test('every source names a definition that exists in its file', () => {
  for (const e of CATALOG) for (const s of e.sources) {
    const name = s.symbol.split('.').pop()!;
    assert.match(source(s.file), new RegExp(`\\b${name}\\b`), `${e.id}: ${s.symbol} not in ${s.file}`);
  }
});

test('every tool of the workspace server is listed with its description and parameters', () => {
  const server = source('app/src/approval-server.ts');
  const names = [...server.matchAll(/registerTool\(\s*'(\w+)'/g)].map((m) => m[1]);
  assert.ok(names.length >= 9);
  assert.deepEqual(CATALOG.filter((e) => e.group === 'Workspace tools').map((e) => e.id.slice('tool.'.length)).sort(), [...names].sort());
  const described = [...server.matchAll(/(\w+): z\.[\w.()]*?\.describe\((['"])(.*?)\2\)/g)].map((m) => `${m[1]}: ${m[3]}`);
  for (const e of CATALOG.filter((x) => x.group === 'Workspace tools')) for (const p of e.params ?? []) assert.ok(described.includes(`${p.name}: ${p.text}`), `${e.id}: parameter ${p.name} differs from the server`);
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

test('outside sources say what can be inspected and never carry provider text', () => {
  const list = externalSources();
  for (const s of list) {
    assert.ok(['shown', 'file', 'hidden', 'unknown'].includes(s.inspectable), s.id);
    if (s.text !== undefined) assert.equal(s.inspectable, 'shown', `${s.id}: only text the workspace holds is shown`);
  }
  assert.ok(list.some((s) => s.id === 'claude.system-prompt' && s.inspectable === 'hidden' && s.text === undefined));
});

test('the tab is available only when the app runs from a checkout', () => {
  assert.equal(instructionsAvailable(''), false);
  assert.equal(instructionsAvailable('/some/checkout'), true);
});
