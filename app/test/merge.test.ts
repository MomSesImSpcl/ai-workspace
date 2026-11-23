// Merging through the workspace (selfdev-004): the merge detection, the guard, request_merge with a fake gh, and
// the empty gh folder for Codex.
import { test, beforeEach } from 'node:test';
import { fileURLToPath } from 'node:url';
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

/** A fake gh and git that keep pull requests and every call (in order) in a JSON file. */
function fakeTools(prs: Record<string, object>, fail: { push?: boolean; merge?: boolean; update?: boolean; notAncestor?: boolean; dirty?: boolean } = {}) {
  const state = join(dir, 'tools-state.json');
  writeFileSync(state, JSON.stringify({ prs, calls: [] }));
  const head = `import { readFileSync, writeFileSync } from 'node:fs';
const s = JSON.parse(readFileSync(${JSON.stringify(state)}, 'utf8'));
const a = process.argv.slice(2);
const save = () => writeFileSync(${JSON.stringify(state)}, JSON.stringify(s));`;
  const gh = join(dir, 'fake-gh.mjs');
  writeFileSync(gh, `${head}
s.calls.push('gh ' + a.join(' '));
if (a[0] === 'pr' && a[1] === 'list') { save(); const pr = s.prs[a[a.indexOf('--head') + 1]]; console.log(JSON.stringify(pr ? [pr] : [])); process.exit(0); }
if (a[0] === 'pr' && a[1] === 'create') { const b = a[a.indexOf('--head') + 1]; s.prs[b] = { number: 9, url: 'https://x/pull/9', title: a[a.indexOf('--title') + 1], state: 'OPEN' }; save(); process.exit(0); }
if (a[0] === 'pr' && a[1] === 'merge') { save(); if (${!!fail.merge}) { console.error('auto-merge is not allowed'); process.exit(1); } process.exit(0); }
save(); process.exit(2);`);
  const git = join(dir, 'fake-git.mjs');
  writeFileSync(git, `${head}
s.calls.push('git ' + a.join(' ')); save();
if (a[0] === 'merge-base' && ${!!fail.notAncestor}) process.exit(1);
if (a[0] === 'status' && ${!!fail.dirty}) console.log(' M app/src/a.ts');
if (a[0] === 'merge' && a[1] === '--no-edit' && ${!!fail.update}) { console.error('CONFLICT (content): Merge conflict in a.ts'); process.exit(1); }
if (a[0] === 'push' && ${!!fail.push}) { console.error('fatal: could not read Username'); process.exit(128); }`);
  process.env.AI_WORKSPACE_GH = gh;
  process.env.AI_WORKSPACE_NPM = fileURLToPath(new URL('./fake-npm.mjs', import.meta.url));
  process.env.AI_WORKSPACE_GIT = git;
  return () => (JSON.parse(readFileSync(state, 'utf8')) as { calls: string[] }).calls.filter((c) => !c.startsWith('gh pr list') && !c.startsWith('git merge-base') && !c.startsWith('git status'));
}

test('request_merge asks first; on Allow the app merges main in, pushes, opens the pull request if needed and turns on auto-merge', async () => {
  try {
    const asked: string[] = [];
    const ask = (answer: boolean | null) => async (detail: string) => { asked.push(detail); return answer; };
    let calls = fakeTools({ fix: { number: 4, url: 'https://x/pull/4', title: 'Fix it', state: 'OPEN' } });
    assert.match(await requestMerge('fix', dir, {}, ask(false)), /did not approve the merge; nothing was pushed or merged/);
    assert.match(await requestMerge('fix', dir, {}, ask(null)), /stopped/);
    assert.deepEqual(calls(), [], 'Deny or a stop runs nothing');
    assert.match(asked[0]!, /Push branch fix and squash-merge pull request #4 "Fix it" into main once typecheck and tests pass/);
    assert.match(await requestMerge('fix', dir, {}, ask(true)), /auto-merge is on for #4/);
    assert.deepEqual(calls(), ['git fetch origin main', 'git merge --no-edit origin/main', 'git push -u origin fix', 'gh pr merge 4 --squash --auto']);
    calls = fakeTools({});
    await assert.rejects(requestMerge('new', dir, {}, ask(true)), /no open pull request.*title/);
    assert.match(await requestMerge('new', dir, { title: 'New thing', body: 'Why' }, ask(true)), /auto-merge is on for #9/);
    assert.deepEqual(calls(), ['git fetch origin main', 'git merge --no-edit origin/main', 'git push -u origin new', 'gh pr create --base main --head new --title New thing --body Why', 'gh pr merge 9 --squash --auto'], 'main merged in, then the push, then the pull request');
    calls = fakeTools({}, { push: true });
    assert.match(await requestMerge('new', dir, { title: 'T' }, ask(true)), /Pushing branch new failed; nothing was merged: fatal/);
    assert.deepEqual(calls(), ['git fetch origin main', 'git merge --no-edit origin/main', 'git push -u origin new'], 'no pull request after a failed push');
    calls = fakeTools({ fix: { number: 4, url: 'u', title: 't', state: 'OPEN' } }, { update: true });
    assert.match(await requestMerge('fix', dir, {}, ask(true)), /up to date with main failed[\s\S]*resolve the conflicts[\s\S]*CONFLICT/);
    assert.deepEqual(calls(), ['git fetch origin main', 'git merge --no-edit origin/main', 'git merge --abort'], 'a conflict is aborted; nothing pushed');
    fakeTools({ fix: { number: 4, url: 'u', title: 't', state: 'OPEN' } }, { merge: true });
    assert.match(await requestMerge('fix', dir, {}, ask(true)), /auto-merge for #4 failed: auto-merge is not allowed/);
    fakeTools({ fix: { number: 4, url: 'u', title: 't', state: 'MERGED', headRefOid: 'a'.repeat(40) } });
    await assert.rejects(requestMerge('fix', dir, {}, ask(true)), /#4 of branch fix is already merged[\s\S]*Do not switch this worktree[\s\S]*Continue in a new chat/);
  } finally {
    delete process.env.AI_WORKSPACE_GH;
    delete process.env.AI_WORKSPACE_GIT;
  }
});

test('request_merge checks the binding before the card and again after Allow; a pull request merged meanwhile stops it (#62)', async () => {
  try {
    const merged = { number: 61, url: 'https://x/pull/61', title: 'Old', state: 'MERGED', headRefOid: 'b'.repeat(40) };
    let asked = 0;
    const allow = async () => { asked++; return true; };
    // A stale binding is refused before anything is asked or run.
    let calls = fakeTools({ fix: { number: 4, url: 'u', title: 't', state: 'OPEN' } });
    await assert.rejects(requestMerge('fix', dir, {}, allow, () => 'The worktree has branch other checked out.'), /branch other checked out/);
    assert.equal(asked, 0);
    assert.deepEqual(calls(), []);
    // The binding goes stale while the card waits: nothing is fetched, merged or pushed.
    let stale = false;
    calls = fakeTools({ fix: { number: 4, url: 'u', title: 't', state: 'OPEN' } });
    const flip = async () => { stale = true; return true; };
    assert.match(await requestMerge('fix', dir, {}, flip, () => (stale ? 'The worktree has a detached HEAD checked out.' : undefined)), /^Nothing was pushed or merged: the binding changed while the card waited\. The worktree has a detached HEAD/);
    assert.deepEqual(calls(), []);
    // The pull request merges while the card waits.
    calls = fakeTools({ fix: { number: 4, url: 'u', title: 't', state: 'OPEN', headRefOid: 'b'.repeat(40) } });
    const mergeMeanwhile = async () => {
      const file = join(dir, 'tools-state.json');
      const st = JSON.parse(readFileSync(file, 'utf8'));
      st.prs.fix.state = 'MERGED';
      writeFileSync(file, JSON.stringify(st));
      return true;
    };
    assert.match(await requestMerge('fix', dir, {}, mergeMeanwhile), /^Nothing was pushed or merged\. Pull request #4 of branch fix is already merged/);
    assert.deepEqual(calls(), []);
    // A merged pull request of an earlier branch with the same name (made again from main) is not this branch's: a new one opens.
    calls = fakeTools({ fix: merged }, { notAncestor: true });
    assert.match(await requestMerge('fix', dir, { title: 'Next' }, allow), /auto-merge is on for #9/);
    assert.deepEqual(calls(), ['git fetch origin main', 'git merge --no-edit origin/main', 'git push -u origin fix', 'gh pr create --base main --head fix --title Next --body ', 'gh pr merge 9 --squash --auto']);
  } finally {
    delete process.env.AI_WORKSPACE_GH;
    delete process.env.AI_WORKSPACE_GIT;
  }
});

test('Codex worktree sessions get an empty gh folder for their shells; others nothing', () => {
  const args = ghBlockArgs(true);
  assert.equal(args[0], '-c');
  const value = JSON.parse(args[1]!.split('GH_CONFIG_DIR=')[1]!) as string;
  assert.ok(existsSync(value) && value.startsWith(process.env.AI_WORKSPACE_HOME!));
  assert.deepEqual(ghBlockArgs(false), []);
});

test('request_merge shows the card at once while the checks run; Allow waits for them, a failure withdraws the card (agent-interface-008)', async () => {
  const open = { fix: { number: 4, url: 'https://x/pull/4', title: 'Fix it', state: 'OPEN' } };
  const never = () => new Promise<boolean | null>(() => {}); // the user has not answered yet
  try {
    let asked = 0;
    let calls = fakeTools(open, { dirty: true });
    assert.match(await requestMerge('fix', dir, {}, async () => { asked++; return true; }), /uncommitted changes \(app\/src\/a\.ts\); nothing was checked, pushed or merged/);
    assert.equal(asked, 0, 'no card for uncommitted work');
    // Checks fail while the card is open: the card is withdrawn, the agent gets the output.
    calls = fakeTools(open);
    process.env.AI_WORKSPACE_FAKE_NPM_FAIL = 'test';
    let statuses: [string, boolean | undefined][] = [];
    const status = (t: string, closed?: boolean) => statuses.push([t, closed]);
    assert.match(await requestMerge('fix', dir, {}, async () => { asked++; return never(); }, undefined, undefined, status), /^npm test failed in the worktree; nothing was pushed or merged[\s\S]*error in test: src\/a\.ts/);
    assert.equal(asked, 1, 'the card went up at once');
    assert.deepEqual(statuses, [['Typecheck and tests are running in the worktree…', undefined], ['npm test failed in the worktree; nothing will be merged.', true]]);
    // Allowed before a failing typecheck: nothing is merged.
    process.env.AI_WORKSPACE_FAKE_NPM_FAIL = 'typecheck';
    statuses = [];
    assert.match(await requestMerge('fix', dir, {}, async () => true, undefined, undefined, status), /^typecheck failed in the worktree/);
    assert.deepEqual(statuses.map(([t]) => t), ['Typecheck and tests are running in the worktree…', 'Allowed: merging once typecheck and tests pass in the worktree…', 'typecheck failed in the worktree; nothing was merged.']);
    assert.deepEqual(calls(), [], 'nothing pushed or merged');
    // Checks pass before the answer: the card says so, then Allow merges.
    delete process.env.AI_WORKSPACE_FAKE_NPM_FAIL;
    statuses = [];
    let allow!: (v: boolean) => void;
    const reply = requestMerge('fix', dir, {}, () => new Promise<boolean>((r) => (allow = r)), undefined, undefined, status);
    while (statuses.length < 2) await new Promise((r) => setTimeout(r, 20));
    assert.equal(statuses[1]![0], 'Checks passed in the worktree: typecheck: passed; npm test: tests 5, pass 5, fail 0');
    allow(true);
    assert.match(await reply, /auto-merge is on for #4/);
  } finally {
    delete process.env.AI_WORKSPACE_FAKE_NPM_FAIL;
  }
});
