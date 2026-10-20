// Restart onto new code and fallback (selfdev-005/006): the last working version's copy and updating the app's
// checkout from main, against real git repositories and a fake npm.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyUpdate, checkForUpdate, lastGood, localState, recordLastGood, updateStatus } from '../src/restart.ts';

let dir = '', repo = '', origin = '';
const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const commit = (cwd: string, file: string, text: string) => {
  mkdirSync(join(cwd, 'app'), { recursive: true });
  writeFileSync(join(cwd, file), text);
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-qm', `change ${file}`);
  return git(cwd, 'rev-parse', 'HEAD');
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ws-restart-'));
  process.env.AI_WORKSPACE_HOME = join(dir, 'home');
  delete process.env.AI_WORKSPACE_FALLBACK;
  // origin is a bare repository; repo is the app's checkout, cloned from it.
  origin = join(dir, 'origin.git');
  const seed = join(dir, 'seed');
  mkdirSync(seed);
  git(seed, 'init', '-q', '-b', 'main');
  commit(seed, 'app/package-lock.json', '{}');
  git(dir, 'clone', '-q', '--bare', seed, origin);
  git(dir, 'clone', '-q', origin, 'repo');
  repo = join(dir, 'repo');
  // npm: `ci` installs a fake Electron package; every call is recorded in the folder it ran in.
  const fake = join(dir, 'fake-npm.mjs');
  writeFileSync(fake, `import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
appendFileSync('npm-calls.txt', process.argv.slice(2).join(' ') + '\\n');
if (process.env.FAKE_NPM_FAIL) { console.error('npm error code E404'); process.exit(1); }
// Like Electron 44, the package comes without its binary; its install.js fetches it.
if (process.argv[2] === 'ci') { mkdirSync('node_modules/electron', { recursive: true }); writeFileSync('node_modules/electron/install.js', "import { mkdirSync, writeFileSync } from 'node:fs'; mkdirSync('node_modules/electron/dist', { recursive: true }); writeFileSync('node_modules/electron/path.txt', 'electron'); writeFileSync('node_modules/electron/dist/electron', '');"); }`);
  process.env.AI_WORKSPACE_NPM = fake;
  delete process.env.FAKE_NPM_FAIL;
});

/** A new commit on origin's main, made in a second clone. */
function pushToMain(file: string, text: string): string {
  const other = join(dir, `other-${Math.random().toString(36).slice(2)}`);
  git(dir, 'clone', '-q', origin, other);
  const c = commit(other, file, text);
  git(other, 'push', '-q', 'origin', 'main');
  return c;
}

test('a version that passed its startup check is kept as a copy with its own Electron; the next one replaces it (selfdev-006)', async () => {
  const first = git(repo, 'rev-parse', 'HEAD');
  assert.match(await recordLastGood(repo, first), /^recorded /);
  const lg = lastGood()!;
  assert.equal(lg.commit, first);
  assert.equal(lg.subject, 'change app/package-lock.json');
  assert.ok(existsSync(join(lg.path, 'app', 'package-lock.json')), 'a checkout of that commit');
  assert.equal(readFileSync(join(lg.path, 'app', 'npm-calls.txt'), 'utf8'), 'ci --no-audit --no-fund\n');
  assert.equal(lg.electron, join(lg.path, 'app', 'node_modules', 'electron', 'dist', 'electron'));
  assert.match(git(repo, 'worktree', 'list'), /\(detached HEAD\)/, 'a detached worktree, no branch');
  assert.match(await recordLastGood(repo, first), /^already recorded/);

  pushToMain('b.txt', 'b');
  await applyUpdate(repo);
  const second = git(repo, 'rev-parse', 'HEAD');
  assert.match(await recordLastGood(repo, second), /^recorded /);
  const next = lastGood()!;
  assert.equal(next.commit, second);
  assert.notEqual(next.slot, lg.slot, 'built in the other slot');
  assert.ok(!existsSync(lg.path), 'the older copy is removed');
  assert.ok(!git(repo, 'worktree', 'list').includes(lg.path));
});

test('only a clean main at the checked commit is recorded, never from a fallback; a failed build keeps the old copy', async () => {
  const head = git(repo, 'rev-parse', 'HEAD');
  assert.match(await recordLastGood(repo, 'f'.repeat(40)), /moved on/);
  writeFileSync(join(repo, 'app', 'package-lock.json'), '{"changed":true}');
  assert.match(await recordLastGood(repo, head), /app\/ has uncommitted changes/);
  git(repo, 'checkout', '-q', '--', '.');
  git(repo, 'switch', '-q', '-c', 'feature');
  assert.match(await recordLastGood(repo, head), /on feature, not main/);
  git(repo, 'switch', '-q', 'main');
  process.env.AI_WORKSPACE_FALLBACK = head;
  assert.match(await recordLastGood(repo, head), /fallback/);
  delete process.env.AI_WORKSPACE_FALLBACK;
  assert.equal(lastGood(), undefined);
  // A changed notes file outside app/ does not count: the copy still matches the code that runs.
  commit(repo, 'notes.txt', 'todo');
  git(repo, 'push', '-q', 'origin', 'main');
  writeFileSync(join(repo, 'notes.txt'), 'todo, edited');
  assert.match(await recordLastGood(repo, git(repo, 'rev-parse', 'HEAD')), /^recorded /);
  pushToMain('c0.txt', 'c');
  assert.equal((await applyUpdate(repo)).dependencies, false, 'and does not block an update');
  writeFileSync(join(repo, 'notes.txt'), 'todo');
  const head2 = git(repo, 'rev-parse', 'HEAD');

  await recordLastGood(repo, head2);
  pushToMain('c.txt', 'c');
  await applyUpdate(repo);
  process.env.FAKE_NPM_FAIL = '1';
  await assert.rejects(recordLastGood(repo, git(repo, 'rev-parse', 'HEAD')), /npm ci failed in the copy \(exit 1\)[\s\S]*E404/);
  assert.equal(lastGood()?.commit, head2, 'the recorded version stays');
  assert.ok(!existsSync(join(process.env.AI_WORKSPACE_HOME!, 'last-good.lock')), 'the lock is released');
});

test('the update fast-forwards main and installs dependencies only when they changed (selfdev-005)', async () => {
  const start = git(repo, 'rev-parse', 'HEAD');
  assert.deepEqual(await applyUpdate(repo), { from: start, to: start, dependencies: false }, 'nothing new');
  const code = pushToMain('app/a.ts', 'x');
  const s = await updateStatus(repo);
  assert.deepEqual([s.branch, s.behind, s.ahead, s.dirty, s.error], ['main', 1, 0, false, undefined]);
  assert.deepEqual(await applyUpdate(repo), { from: start, to: code, dependencies: false });
  assert.ok(!existsSync(join(repo, 'app', 'npm-calls.txt')), 'no npm without a dependency change');
  const deps = pushToMain('app/package-lock.json', '{"v":2}');
  assert.deepEqual(await applyUpdate(repo), { from: code, to: deps, dependencies: true });
  assert.equal(readFileSync(join(repo, 'app', 'npm-calls.txt'), 'utf8'), 'install --no-save --no-audit --no-fund\n', 'npm install, not npm ci: the running Electron stays in place');
});

test("the update never touches the user's own work: another branch, uncommitted changes or local commits are refused", async () => {
  pushToMain('d.txt', 'd');
  git(repo, 'switch', '-q', '-c', 'try-agent-branch');
  await assert.rejects(applyUpdate(repo), /Must be on main to update/);
  assert.deepEqual(await checkForUpdate(repo), { state: 'blocked', reason: 'Must be on main to update' });
  assert.deepEqual(await localState(repo), { branch: 'try-agent-branch', dirty: false });
  git(repo, 'switch', '-q', 'main');
  writeFileSync(join(repo, 'app', 'package-lock.json'), 'edited');
  await assert.rejects(applyUpdate(repo), /Uncommitted changes in app\//);
  assert.deepEqual(await localState(repo), { branch: 'main', dirty: true });
  git(repo, 'checkout', '-q', '--', '.');
  commit(repo, 'local.txt', 'mine');
  await assert.rejects(applyUpdate(repo), /main has 1 local commit not on GitHub/);
  assert.equal(readFileSync(join(repo, 'local.txt'), 'utf8'), 'mine');
  const s = await updateStatus(repo);
  assert.deepEqual([s.behind, s.ahead], [1, 1]);
});

test('an unreachable origin is reported, with the counts from the last fetch', async () => {
  git(repo, 'remote', 'set-url', 'origin', join(dir, 'missing.git'));
  const s = await updateStatus(repo);
  assert.match(s.error ?? '', /git fetch failed/);
  assert.equal(s.branch, 'main');
  assert.equal(s.behind, 0);
});

test('Check for updates: new commits, nothing new, and a pull request with auto-merge that merges or fails (selfdev-005)', async () => {
  // gh answers from a JSON file the test rewrites: the open pull requests and each one's state.
  const prs = join(dir, 'prs.json');
  const fakeGh = join(dir, 'fake-gh.mjs');
  writeFileSync(fakeGh, `import { readFileSync } from 'node:fs';
const prs = JSON.parse(readFileSync(${JSON.stringify(prs)}, 'utf8'));
const [cmd, sub, n] = process.argv.slice(2);
if (cmd === 'pr' && sub === 'list') console.log(JSON.stringify(prs.filter((p) => p.state === 'OPEN')));
else if (cmd === 'pr' && sub === 'view') console.log(JSON.stringify(prs.find((p) => p.number === Number(n))));
else process.exit(1);`);
  process.env.AI_WORKSPACE_GH = fakeGh;
  try {
    const open = (n: number, checks: string[] = []) => ({ number: n, state: 'OPEN', autoMergeRequest: { mergeMethod: 'SQUASH' }, statusCheckRollup: checks.map((c) => ({ conclusion: c })) });
    writeFileSync(prs, JSON.stringify([{ number: 7, state: 'OPEN', autoMergeRequest: null }]));
    assert.deepEqual(await checkForUpdate(repo), { state: 'up-to-date' }, 'an open pull request without auto-merge is not awaited');
    writeFileSync(prs, JSON.stringify([open(8)]));
    assert.deepEqual(await checkForUpdate(repo), { state: 'waiting', prs: [8] });
    writeFileSync(prs, JSON.stringify([open(8, ['SUCCESS', ''])]));
    assert.deepEqual(await checkForUpdate(repo, [8]), { state: 'waiting', prs: [8] }, 'checks still running');
    writeFileSync(prs, JSON.stringify([{ number: 8, state: 'MERGED' }]));
    assert.deepEqual(await checkForUpdate(repo, [8]), { state: 'waiting', prs: [8] }, 'merged on GitHub, but main not fetched yet');
    pushToMain('merged.txt', 'm');
    assert.deepEqual(await checkForUpdate(repo, [8]), { state: 'update' });
    await applyUpdate(repo);
    writeFileSync(prs, JSON.stringify([open(9, ['SUCCESS', 'FAILURE'])]));
    assert.deepEqual(await checkForUpdate(repo, [9]), { state: 'failed', prs: [9] }, 'a failed check: it will not merge by itself');
    writeFileSync(prs, JSON.stringify([{ number: 9, state: 'CLOSED', autoMergeRequest: null }]));
    assert.deepEqual(await checkForUpdate(repo, [9]), { state: 'failed', prs: [9] });
    process.env.AI_WORKSPACE_GH = join(dir, 'missing-gh');
    assert.deepEqual(await checkForUpdate(repo), { state: 'up-to-date' }, 'without gh nothing is awaited');
  } finally {
    delete process.env.AI_WORKSPACE_GH;
  }
});
