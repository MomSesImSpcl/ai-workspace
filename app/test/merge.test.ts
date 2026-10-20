// Merging through the workspace (selfdev-004): the merge detection, the guard, request_merge with a fake gh, and
// the empty gh folder for Codex.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { guardDecision } from '../src/guard.ts';
import { ghBlockArgs, mergeCommand, requestMerge } from '../src/merge.ts';

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ws-merge-'));
  process.env.AI_WORKSPACE_HOME = join(dir, 'home');
});

test('gh merges are recognized in any spelling; other gh and git commands are not', () => {
  for (const c of ['gh pr merge 12 --squash', 'cd app && gh pr merge --auto', '"C:/Program Files/GitHub CLI/gh.exe" pr merge 3', 'gh api -X PUT repos/o/r/pulls/7/merge']) assert.ok(mergeCommand(c), c);
  for (const c of ['gh pr view 12', 'gh pr create --title merge', 'git merge origin/main', 'gh api repos/o/r/pulls/7', 'echo gh pr status']) assert.ok(!mergeCommand(c), c);
});

test('the guard denies gh merges in app-project sessions only, with the way to merge', () => {
  const g = { allow: join(dir, 'wt'), deny: [join(dir, 'live')] };
  const input = { tool_name: 'Bash', tool_input: { command: 'gh pr merge 5 --squash' }, cwd: g.allow };
  const denied = guardDecision({ ...g, merge: true }, input) as { hookSpecificOutput?: { permissionDecision: string; permissionDecisionReason: string } };
  assert.equal(denied.hookSpecificOutput?.permissionDecision, 'deny');
  assert.match(denied.hookSpecificOutput!.permissionDecisionReason, /request_merge/);
  assert.deepEqual(guardDecision(g, input), {}, 'other projects keep gh');
});

/** A fake gh that keeps pull requests and the calls it got in a JSON file. */
function fakeGh(prs: Record<string, object>, failMerge = false) {
  const state = join(dir, 'gh-state.json');
  writeFileSync(state, JSON.stringify({ prs, calls: [] }));
  const script = join(dir, 'fake-gh.mjs');
  writeFileSync(script, `import { readFileSync, writeFileSync } from 'node:fs';
const s = JSON.parse(readFileSync(${JSON.stringify(state)}, 'utf8'));
const a = process.argv.slice(2);
s.calls.push(a.join(' '));
const save = () => writeFileSync(${JSON.stringify(state)}, JSON.stringify(s));
if (a[0] === 'pr' && a[1] === 'view') { save(); const pr = s.prs[a[2]]; if (!pr) { console.error('no pull requests found'); process.exit(1); } console.log(JSON.stringify(pr)); process.exit(0); }
if (a[0] === 'pr' && a[1] === 'create') { const b = a[a.indexOf('--head') + 1]; s.prs[b] = { number: 9, url: 'https://x/pull/9', title: a[a.indexOf('--title') + 1], state: 'OPEN' }; save(); process.exit(0); }
if (a[0] === 'pr' && a[1] === 'merge') { save(); if (${failMerge}) { console.error('required status checks have not succeeded'); process.exit(1); } process.exit(0); }
save(); process.exit(2);`);
  process.env.AI_WORKSPACE_GH = script;
  return () => (JSON.parse(readFileSync(state, 'utf8')) as { calls: string[] }).calls;
}

test('request_merge asks once and merges only after Allow; it opens a missing pull request', async () => {
  try {
    let calls = fakeGh({ fix: { number: 4, url: 'https://x/pull/4', title: 'Fix it', state: 'OPEN' } });
    const asked: string[] = [];
    const ask = (answer: boolean | null) => async (detail: string) => { asked.push(detail); return answer; };
    assert.match(await requestMerge('fix', dir, { checks: 'typecheck clean; npm test 70/70' }, ask(false)), /did not approve/);
    assert.ok(!calls().some((c) => c.startsWith('pr merge')), 'Deny merges nothing');
    assert.match(asked[0]!, /#4 "Fix it".*typecheck clean; npm test 70\/70/);
    assert.match(await requestMerge('fix', dir, { checks: 'ok' }, ask(true)), /Merged #4/);
    assert.ok(calls().includes('pr merge 4 --squash'));
    calls = fakeGh({});
    await assert.rejects(requestMerge('new', dir, { checks: 'ok' }, ask(true)), /no open pull request.*title/);
    assert.match(await requestMerge('new', dir, { checks: 'ok', title: 'New thing', body: 'Why' }, ask(true)), /Merged #9/);
    assert.ok(calls().some((c) => c.startsWith('pr create --base main --head new --title New thing')));
    fakeGh({ fix: { number: 4, url: 'u', title: 't', state: 'OPEN' } }, true);
    assert.match(await requestMerge('fix', dir, { checks: 'ok' }, ask(true)), /failed: required status checks[\s\S]*call request_merge again/);
    fakeGh({ fix: { number: 4, url: 'u', title: 't', state: 'MERGED' } });
    await assert.rejects(requestMerge('fix', dir, { checks: 'ok' }, ask(true)), /already merged/);
  } finally {
    delete process.env.AI_WORKSPACE_GH;
  }
});

test('Codex worktree sessions get an empty gh folder for their shells; others nothing', () => {
  const args = ghBlockArgs(true);
  assert.equal(args[0], '-c');
  const value = JSON.parse(args[1]!.split('GH_CONFIG_DIR=')[1]!) as string;
  assert.ok(existsSync(value) && value.startsWith(process.env.AI_WORKSPACE_HOME!));
  assert.deepEqual(ghBlockArgs(false), []);
});
