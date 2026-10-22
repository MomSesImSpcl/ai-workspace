// Chat/worktree binding checks and explicit continuation (#62, ADR 0019): a stale binding (merged pull request,
// another branch checked out, missing worktree or branch, foreign folder) stops work and publication with an
// explanation; a confirmed continuation carries the conversation to a new binding; cleanup, restore and active
// sessions keep their rules. Real git with a local bare "origin"; gh is a fake that keeps pull requests in a file.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bindingProblem, continueSession } from '../src/binding.ts';
import { requestMerge } from '../src/merge.ts';
import { addMessage, createSession, loadSession, readEvents, saveSession, sessionWorking, turns, type SessionAgent } from '../src/sessions.ts';
import { registerProject } from '../src/store.ts';
import { createTask } from '../src/tasks.ts';
import { runTurn } from '../src/turn.ts';
import { serve } from '../src/ui.ts';

let dir = '', root = '', origin = '', ghState = '';
/** Runs git in `cwd`; a failure throws with git's message. */
const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const who = ['-c', 'user.name=t', '-c', 'user.email=t@example.com'];
/** Commits one new file in `cwd` and returns the new commit. */
const commit = (cwd: string, file: string) => {
  writeFileSync(join(cwd, file), file);
  git(cwd, 'add', '.');
  git(cwd, ...who, 'commit', '-qm', file);
  return git(cwd, 'rev-parse', 'HEAD');
};
/** The fake gh's pull requests per head branch, and every call it got. */
const gh = () => JSON.parse(readFileSync(ghState, 'utf8')) as { prs: Record<string, object[]>; calls: string[] };
const setPrs = (branch: string, prs: object[]) => { const s = gh(); s.prs[branch] = prs; writeFileSync(ghState, JSON.stringify(s)); };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ws-binding-'));
  process.env.AI_WORKSPACE_HOME = join(dir, 'home');
  process.env.AI_WORKSPACE_SESSION_IDLE_MS = '300';
  origin = join(dir, 'origin.git');
  git(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  root = join(dir, 'project');
  mkdirSync(root);
  git(root, 'init', '-q', '-b', 'main');
  commit(root, 'a.txt');
  git(root, 'remote', 'add', 'origin', origin);
  git(root, 'push', '-q', '-u', 'origin', 'main');
  registerProject(root, 'P');
  process.env.AI_WORKSPACE_REPO = root; // this test repository plays the app's own
  ghState = join(dir, 'gh.json');
  writeFileSync(ghState, JSON.stringify({ prs: {}, calls: [] }));
  const fake = join(dir, 'fake-gh.mjs');
  writeFileSync(fake, `import { readFileSync, writeFileSync } from 'node:fs';
const s = JSON.parse(readFileSync(${JSON.stringify(ghState)}, 'utf8'));
const a = process.argv.slice(2);
const save = () => writeFileSync(${JSON.stringify(ghState)}, JSON.stringify(s));
s.calls.push(a.join(' ')); save();
const head = a[a.indexOf('--head') + 1];
if (a[0] === 'pr' && a[1] === 'list') { console.log(JSON.stringify(s.prs[head] ?? [])); process.exit(0); }
if (a[0] === 'pr' && a[1] === 'create') { (s.prs[head] ??= []).unshift({ number: 70, url: 'https://github.example/pull/70', title: a[a.indexOf('--title') + 1], state: 'OPEN' }); save(); process.exit(0); }
if (a[0] === 'pr' && a[1] === 'merge') process.exit(0);
process.exit(2);`);
  process.env.AI_WORKSPACE_GH = fake;
});

interface Run { root: string; prompt: string; history: string }
/** A fake agent that records where each turn ran and the conversation it got. */
const recording = (runs: Run[]): Record<string, SessionAgent> => ({
  'claude-code': { open: (_s, r) => ({ turn: async (i) => { runs.push({ root: r, prompt: i.prompt, history: i.history }); i.emit({ type: 'text', text: `done: ${i.prompt}` }); return {}; }, close() {} }), permissions: () => ({ line: 'fake' }), catalog: () => ({ models: [] }), inventory: async () => [] },
});
const say = async (id: string, text: string, runs: Run[]) => { addMessage(id, text); await runTurn(id, recording(runs)); };
const lastTurn = (id: string) => turns(readEvents(id), false).at(-1)!;
/** The binding check request_merge runs before the card and after Allow (`approval-server.ts`). */
const checkOf = (id: string) => () => bindingProblem(loadSession(id), { merged: false });
const chat = async (name: string, runs: Run[]) => {
  const s = createSession('P', 'Chat', { integration: 'claude-code' }, { name });
  await say(s.id, `start ${name}`, runs);
  return loadSession(s.id);
};

test('merged pull request: the chat stops before work and publication; a confirmed continuation opens the intended new pull request (#62)', async () => {
  const runs: Run[] = [];
  const a = await chat('feature-a', runs);
  const wtA = a.worktree!;
  const tipA = commit(wtA.path, 'feature-a.txt');
  git(wtA.path, 'push', '-q', '-u', 'origin', 'feature-a');
  // GitHub squash-merges #61 into main; the running app's checkout does not see it yet (no Update and restart).
  const hub = join(dir, 'hub');
  git(dir, 'clone', '-q', origin, hub);
  git(hub, 'merge', '-q', '--squash', 'origin/feature-a');
  git(hub, ...who, 'commit', '-qm', 'Feature A (#61)');
  git(hub, 'push', '-q', 'origin', 'main');
  setPrs('feature-a', [{ number: 61, url: 'https://github.example/pull/61', title: 'Feature A', state: 'MERGED', headRefOid: tipA }]);
  writeFileSync(join(wtA.path, 'draft.txt'), 'unsaved'); // uncommitted work in the old worktree

  await say(a.id, 'now build feature B', runs);
  assert.equal(runs.length, 1, 'no agent ran on the merged branch');
  const blocked = lastTurn(a.id);
  assert.equal(blocked.binding, true);
  assert.match(blocked.error!, /Pull request #61 \(https:\/\/github\.example\/pull\/61\) of branch feature-a is already merged/);
  assert.match(blocked.error!, new RegExp(`Chat ${a.id} of project P is bound to branch feature-a`));
  assert.match(blocked.error!, /keeps 1 uncommitted file and 0 commits on no remote branch, untouched/);
  assert.match(blocked.error!, /Continue in a new chat/);
  let asked = 0;
  const allow = async () => { asked++; return true; };
  await assert.rejects(requestMerge(wtA.branch, wtA.path, { checks: 'ok', title: 'Feature B' }, allow, checkOf(a.id)), /#61 of branch feature-a is already merged/);
  assert.equal(asked, 0, 'no card for the stale chat');

  const b = continueSession(a.id, { name: 'feature-b' });
  assert.deepEqual(loadSession(a.id).worktree, wtA, 'the stale binding is unchanged');
  assert.equal(readFileSync(join(wtA.path, 'draft.txt'), 'utf8'), 'unsaved', 'uncommitted work stays where it was');
  assert.deepEqual(b.continuedFrom, { id: a.id, turn: 2 });
  assert.deepEqual({ ...b.worktree, path: undefined }, { path: undefined, branch: 'feature-b', base: 'origin/main' });
  assert.equal(b.title, loadSession(a.id).title);
  assert.ok(readEvents(a.id).some((e) => e.type === 'notice' && e.text.includes(`continues in chat ${b.id} on branch feature-b`)));
  assert.ok(readEvents(b.id).some((e) => e.type === 'notice' && e.text.includes(`Continued from chat ${a.id}, which stays bound to branch feature-a`)));
  assert.equal(lastTurn(b.id).binding, true, 'the copied turn keeps its record; the UI offers no second continuation for it (continuedFrom.turn)');

  await say(b.id, 'go on with feature B', runs);
  const wtB = loadSession(b.id).worktree!;
  assert.equal(runs.length, 2);
  assert.equal(runs[1]!.root, wtB.path);
  assert.match(runs[1]!.history, /start feature-a[\s\S]*now build feature B/, 'the agent gets the conversation so far');
  assert.equal(git(wtB.path, 'rev-parse', 'HEAD'), git(hub, 'rev-parse', 'HEAD'), 'cut from freshly fetched origin/main');
  assert.notEqual(git(root, 'rev-parse', 'HEAD'), git(hub, 'rev-parse', 'HEAD'), 'the running checkout still lags behind');
  assert.equal(git(wtB.path, 'config', '--default', '', '--get', 'branch.feature-b.remote'), '', 'the new branch does not track main');
  assert.equal(existsSync(join(wtB.path, 'draft.txt')), false, 'nothing was moved');
  assert.ok(readEvents(b.id).some((e) => e.type === 'notice' && /from .*\(freshly fetched origin\/main\)/.test(e.text)));

  commit(wtB.path, 'feature-b.txt');
  const text = await requestMerge(wtB.branch, wtB.path, { checks: 'typecheck clean; tests pass', title: 'Feature B' }, allow, checkOf(b.id));
  assert.match(text, /^Pushed feature-b; auto-merge is on for #70/);
  assert.equal(asked, 1);
  assert.ok(gh().calls.includes('pr create --base main --head feature-b --title Feature B --body '));
  assert.ok(gh().calls.includes('pr merge 70 --squash --auto'));
  assert.equal(gh().calls.filter((c) => c.startsWith('pr create')).length, 1, 'only the intended pull request was opened');
  assert.match(git(root, 'ls-remote', '--heads', 'origin'), /refs\/heads\/feature-b/);
  await assert.rejects(requestMerge(wtA.branch, wtA.path, { checks: 'ok' }, allow, checkOf(a.id)), /already merged/, 'the stale chat still cannot publish');
  assert.equal(asked, 1);
  assert.equal(bindingProblem(loadSession(b.id)), undefined, 'the continued chat stays valid with its open pull request');
});

test('another branch checked out in the worktree blocks the chat, its tasks and its publication; continuing on that branch is explicit (#62)', async () => {
  const runs: Run[] = [];
  const a = await chat('merge-conflict-test', runs);
  const wt = a.worktree!;
  // As in #62: the agent prepared a new branch in the same worktree.
  git(wt.path, 'switch', '-q', '-c', 'configured-implementer');
  const head = commit(wt.path, 'fix.txt');
  await say(a.id, 'publish it', runs);
  assert.equal(runs.length, 1);
  assert.match(lastTurn(a.id).error!, new RegExp(`has branch configured-implementer checked out \\(HEAD ${head.slice(0, 7)}\\), not the bound branch merge-conflict-test`));
  assert.match(lastTurn(a.id).error!, /0 uncommitted files and 1 commit on no remote branch/);
  await assert.rejects(requestMerge(wt.branch, wt.path, { checks: 'ok', title: 'Fix' }, async () => true, checkOf(a.id)), /configured-implementer checked out/);
  assert.doesNotMatch(git(root, 'ls-remote', '--heads', 'origin'), /merge-conflict-test|configured-implementer/, 'nothing was pushed');
  assert.deepEqual(gh().calls, [], 'gh was not even asked');

  const t = createTask({ projectId: 'P', goal: 'edit', role: 'Implementation', sessionId: a.id, setup: ['tool:Read'] });
  await runTurn(t.id, recording(runs));
  assert.equal(runs.length, 1, 'the task of the stale chat did not run');
  assert.match(lastTurn(t.id).error!, /^The worktree has branch configured-implementer checked out[\s\S]*Task .* continue the work from its chat\.$/);

  assert.throws(() => continueSession(a.id, { name: 'configured-implementer' }), /already exists/);
  assert.throws(() => continueSession(a.id, { path: root }), /Not a worktree of project P/);
  assert.throws(() => continueSession(t.id, { path: wt.path }), /A task continues from its chat/);
  assert.throws(() => continueSession(a.id, {}), /Pick a new branch name or an existing branch/);
  const b = continueSession(a.id, { path: wt.path });
  assert.deepEqual(b.worktree, { path: wt.path, branch: 'configured-implementer', ready: true });
  await say(b.id, 'publish it', runs);
  assert.equal(runs.length, 2);
  assert.equal(runs[1]!.root, wt.path);
  assert.equal(git(wt.path, 'rev-parse', 'HEAD'), head, 'nothing was reset or switched');
  assert.match(bindingProblem(loadSession(a.id))!, /configured-implementer checked out/, 'the old chat stays stale');

  git(wt.path, 'switch', '-q', '--detach');
  assert.match(bindingProblem(loadSession(b.id))!, /has a detached HEAD checked out/);
  git(wt.path, 'switch', '-q', 'configured-implementer');
  git(root, 'branch', '-D', 'merge-conflict-test');
  assert.match(bindingProblem(loadSession(a.id))!, /Branch merge-conflict-test no longer exists\./);
  assert.equal(bindingProblem(loadSession(b.id)), undefined);
});

test('a missing worktree, a plain folder in its place and foreign or non-app bindings are refused with what they are (#62)', async () => {
  const runs: Run[] = [];
  const a = await chat('gone-one', runs);
  const wt = a.worktree!;
  git(root, 'worktree', 'remove', '--force', wt.path);
  await say(a.id, 'go on', runs);
  assert.equal(runs.length, 1);
  assert.equal(lastTurn(a.id).binding, true);
  assert.match(lastTurn(a.id).error!, /worktree is gone/);
  mkdirSync(wt.path);
  assert.match(bindingProblem(loadSession(a.id))!, /is not a worktree of the repository/);
  const foreign = { path: join(dir, 'elsewhere', 'w'), branch: 'w', ready: true };
  assert.match(bindingProblem({ id: 'x', projectId: 'P', worktree: foreign })!, /is not a worktree the workspace keeps for project P/);
  const other = join(dir, 'other');
  mkdirSync(other);
  registerProject(other, 'Q');
  assert.match(bindingProblem({ id: 'x', projectId: 'Q', worktree: wt })!, /Project Q is not the app project/);
  assert.match(bindingProblem({ id: 'x', projectId: 'gone', worktree: wt })!, /Project gone is no longer in the workspace/);
  assert.equal(bindingProblem({ id: 'x', projectId: 'P', worktree: { path: join(dir, 'home', 'worktrees', 'P', 'later'), branch: 'later' } }), undefined, 'a planned worktree not made yet passes');
});

test('cleanup keeps a stale chat\'s unmerged work; a restored chat of a merged branch is not mistaken for the merged one (#62)', async () => {
  const { cleanupBranches, replanBranch } = await import('../src/branches.ts');
  const runs: Run[] = [];
  const stale = await chat('stale', runs);
  git(stale.worktree!.path, 'switch', '-q', '-c', 'prepared');
  commit(stale.worktree!.path, 'prepared.txt');
  const done = await chat('done', runs);
  const tip = commit(done.worktree!.path, 'done.txt');
  git(done.worktree!.path, 'push', '-q', '-u', 'origin', 'done');
  setPrs('done', [{ number: 64, url: 'https://github.example/pull/64', title: 'Done', state: 'MERGED', headRefOid: tip }]);
  await say(done.id, 'more', runs);
  assert.match(lastTurn(done.id).error!, /#64 .* is already merged/);
  // Update and restart brings the squash merge into the checkout; the start-up cleanup follows.
  git(root, 'merge', '-q', '--squash', 'done');
  git(root, ...who, 'commit', '-qm', 'Done (#64)');
  assert.deepEqual(await cleanupBranches(), ['done']);
  assert.equal(existsSync(stale.worktree!.path), true, 'unmerged prepared work is never removed');
  assert.equal(loadSession(stale.id).archived, undefined);
  assert.equal(loadSession(done.id).archived, true);
  // Restored, the chat gets branch "done" again from main: #64's head is not in it, so it works and can publish anew.
  saveSession({ ...replanBranch(loadSession(done.id)), archived: false });
  const before = runs.length;
  await say(done.id, 'again', runs);
  assert.equal(runs.length, before + 1);
  assert.equal(lastTurn(done.id).state, 'done');
  assert.equal(bindingProblem(loadSession(done.id)), undefined);
});

test('continuing needs the user\'s confirmation and waits while the chat works; the old chat is left as it is (#62)', async () => {
  const runs: Run[] = [];
  const a = await chat('busy', runs);
  const wt = a.worktree!;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  addMessage(a.id, 'switch branches');
  const turn = runTurn(a.id, { 'claude-code': { open: () => ({ turn: async () => { git(wt.path, 'switch', '-q', '-c', 'side'); await gate; return {}; }, close() {} }), permissions: () => ({ line: 'fake' }), catalog: () => ({ models: [] }), inventory: async () => [] } });
  while (!sessionWorking(a.id)) await new Promise((r) => setTimeout(r, 20));
  assert.throws(() => continueSession(a.id, { name: 'next' }), /This chat is working/);
  release();
  await turn;
  const server = serve(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const post = async (path: string, body: unknown) => {
    const res = await fetch(base + path, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  };
  try {
    const unconfirmed = await post(`/api/sessions/${a.id}/continue`, { worktreeName: 'next' });
    assert.equal(unconfirmed.status, 400);
    assert.match(unconfirmed.data.error, /needs your confirmation/);
    assert.equal((await post(`/api/sessions/${a.id}/continue`, { confirmed: true, worktreeName: 'bad name' })).status, 400);
    const { status, data } = await post(`/api/sessions/${a.id}/continue`, { confirmed: true, worktreeName: 'next' });
    assert.equal(status, 200);
    assert.equal(data.continuedFrom.id, a.id);
    assert.equal(data.worktree.branch, 'next');
  } finally {
    server.close();
  }
  assert.deepEqual(loadSession(a.id).worktree, wt);
  assert.equal(git(wt.path, 'branch', '--show-current'), 'side', 'the old worktree was not switched back');
});
