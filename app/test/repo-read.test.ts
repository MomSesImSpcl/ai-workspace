// read_repo (#31): commit history, branches and status through git, pull requests and issues through gh, read only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRepo } from '../src/repo-read.ts';

const repo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ws-repo-'));
  const git = (...a: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { cwd: dir, encoding: 'utf8' }).stdout.trim();
  git('init', '-q', '-b', 'main');
  for (const f of ['a.txt', 'b.txt']) { writeFileSync(join(dir, f), f); git('add', '.'); git('commit', '-qm', `add ${f}`); }
  return { dir, git };
};

test('log and show read the commit history; a ref that looks like an option is refused', async () => {
  const { dir, git } = repo();
  const log = await readRepo(dir, { action: 'log' });
  assert.match(log, /^\w+ \d{4}-\d{2}-\d{2} t: add b\.txt\n\w+ .* t: add a\.txt$/);
  assert.equal((await readRepo(dir, { action: 'log', limit: 1 })).split('\n').length, 1);
  assert.match(await readRepo(dir, { action: 'log', path: 'a.txt' }), /^\w+ .*add a\.txt$/);
  const show = await readRepo(dir, { action: 'show', ref: git('rev-parse', 'HEAD') });
  assert.match(show, /add b\.txt[\s\S]*b\.txt \| 1 \+[\s\S]*\+b\.txt/);
  await assert.rejects(readRepo(dir, { action: 'show', ref: '--output=x' }), /Not a branch or commit name/);
  await assert.rejects(readRepo(dir, { action: 'show' }), /needs ref/);
});

test('branches lists local and remote branches with worktree and ahead/behind; status reads the checkout or a project worktree', async () => {
  const { dir, git } = repo();
  const wt = join(mkdtempSync(join(tmpdir(), 'ws-wt-')), 'tree');
  git('worktree', 'add', '-q', '-b', 'feature', wt);
  writeFileSync(join(wt, 'c.txt'), 'c'); git('-C', wt, 'add', '.'); git('-C', wt, 'commit', '-qm', 'add c.txt');
  git('branch', 'old', 'HEAD~1');
  git('update-ref', 'refs/remotes/origin/feature', 'feature');
  git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/feature');
  const list = (await readRepo(dir, { action: 'branches' })).split('\n');
  assert.equal(list.length, 4);
  assert.match(list.find((l) => l.startsWith('main:'))!, /^main: ahead 0, behind 0, worktree /);
  assert.match(list.find((l) => l.startsWith('feature:'))!, /^feature: ahead 1, behind 0, worktree .*tree$/);
  assert.equal(list.find((l) => l.startsWith('old:')), 'old: ahead 0, behind 1');
  assert.equal(list.find((l) => l.startsWith('origin/feature')), 'origin/feature (remote): ahead 1, behind 0');

  assert.equal(await readRepo(dir, { action: 'status' }), 'Clean: no changes.');
  writeFileSync(join(wt, 'new.txt'), 'x');
  assert.equal(await readRepo(dir, { action: 'status', path: wt }), '?? new.txt');
  assert.equal(await readRepo(dir, { action: 'status' }), 'Clean: no changes.');
  await assert.rejects(readRepo(dir, { action: 'status', path: tmpdir() }), /Not a worktree of this project/);
  await assert.rejects(readRepo(dir, { action: 'status', path: join(realpathSync(dir), '..') }), /Not a worktree of this project/);
});

test('status accepts filesystem aliases of registered roots and leaves the index, refs and worktree registrations unchanged', async () => {
  const { dir, git } = repo();
  const parent = mkdtempSync(join(tmpdir(), 'ws-alias-'));
  const wt = join(parent, 'tree with spaces-\u00e9');
  const alias = join(parent, 'linked');
  const registration = git('worktree', 'add', '-q', '-b', 'alias-test', wt);
  assert.ok(existsSync(join(wt, '.git')), registration);
  symlinkSync(wt, alias, process.platform === 'win32' ? 'junction' : 'dir');
  mkdirSync(join(wt, 'child'));
  const index = git('-C', wt, 'rev-parse', '--path-format=absolute', '--git-path', 'index');
  const indexBefore = readFileSync(index);
  const refsBefore = git('show-ref');
  const treesBefore = git('worktree', 'list', '--porcelain', '-z');
  // A stat change normally makes git status refresh the index even with unchanged contents.
  writeFileSync(join(wt, 'a.txt'), 'a.txt');
  writeFileSync(join(wt, 'new.txt'), 'new');
  try {
    for (const path of [wt, alias, realpathSync.native(wt), join(alias, 'child', '..')]) {
      assert.equal(await readRepo(dir, { action: 'status', path }), '?? new.txt');
    }
    assert.equal(await readRepo(dir, { action: 'status', path: realpathSync.native(dir) }), 'Clean: no changes.');
    assert.ok((await readRepo(dir, { action: 'branches' })).includes('tree with spaces-\u00e9'));
    for (const path of [join(alias, 'child'), parent, join(parent, 'missing')]) {
      await assert.rejects(readRepo(dir, { action: 'status', path }), /Not a worktree of this project/);
    }
    assert.deepEqual(readFileSync(index), indexBefore);
    assert.equal(existsSync(`${index}.lock`), false);
    assert.equal(git('show-ref'), refsBefore);
    assert.equal(git('worktree', 'list', '--porcelain', '-z'), treesBefore);
  } finally {
    rmSync(alias); // Remove only the link, never its target.
    git('worktree', 'remove', '--force', wt);
    rmSync(parent, { recursive: true, force: true });
  }
});

test('status refuses foreign repositories, their aliases, and missing registered worktrees', async () => {
  const { dir, git } = repo();
  const foreign = repo();
  const parent = mkdtempSync(join(tmpdir(), 'ws-foreign-'));
  const alias = join(parent, 'linked');
  const missing = join(parent, 'removed');
  symlinkSync(foreign.dir, alias, process.platform === 'win32' ? 'junction' : 'dir');
  git('worktree', 'add', '-q', '-b', 'removed', missing);
  rmSync(missing, { recursive: true, force: true });
  try {
    for (const path of [foreign.dir, alias, missing]) {
      await assert.rejects(readRepo(dir, { action: 'status', path }), /Not a worktree of this project/);
    }
    // One stale registration must not prevent reading a valid worktree.
    assert.equal(await readRepo(dir, { action: 'status', path: dir }), 'Clean: no changes.');
  } finally { rmSync(alias); rmSync(parent, { recursive: true, force: true }); }
});

test('status does not fold distinct paths on a case-sensitive filesystem', async (t) => {
  const { dir, git } = repo();
  const parent = mkdtempSync(join(tmpdir(), 'ws-case-'));
  const wt = join(parent, 'Tree');
  const other = join(parent, 'tree');
  git('worktree', 'add', '-q', '-b', 'case-test', wt);
  try {
    if (existsSync(other)) {
      assert.equal(await readRepo(dir, { action: 'status', path: other }), 'Clean: no changes.');
      t.diagnostic('Case-insensitive volume: alternate case identifies the same worktree.');
    } else {
      mkdirSync(other);
      await assert.rejects(readRepo(dir, { action: 'status', path: other }), /Not a worktree of this project/);
    }
  } finally { git('worktree', 'remove', wt); rmSync(parent, { recursive: true, force: true }); }
});

test('status accepts Windows 8.3 worktree paths', { skip: process.platform !== 'win32' }, async (t) => {
  const { dir, git } = repo();
  const parent = mkdtempSync(join(tmpdir(), 'ws-short-'));
  const wt = join(parent, 'worktree with a long name');
  git('worktree', 'add', '-q', '-b', 'short-test', wt);
  try {
    const result = spawnSync('cmd.exe', ['/d', '/c', `for %I in ("${wt}") do @echo %~sI`], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const short = result.stdout.trim();
    if (!short.includes('~')) { t.skip('8.3 names are disabled on this volume'); return; }
    assert.equal(realpathSync.native(short), realpathSync.native(wt));
    writeFileSync(join(wt, 'short.txt'), 'new');
    assert.equal(await readRepo(dir, { action: 'status', path: short }), '?? short.txt');
  } finally { git('worktree', 'remove', '--force', wt); rmSync(parent, { recursive: true, force: true }); }
});

test('pull requests and issues come from gh; a failed gh says so', async () => {
  const { dir } = repo();
  const fake = join(dir, 'fake-gh.mjs');
  writeFileSync(fake, `const [a, b] = process.argv.slice(2);
if (a === 'pr' && b === 'list') console.log(JSON.stringify([{ number: 5, title: 'Fix it', state: 'OPEN', headRefName: 'fix', isDraft: false, updatedAt: '2026-10-20T10:00:00Z' }]));
else if (a === 'pr' && b === 'view') console.log(JSON.stringify({ number: 5, title: 'Fix it', state: 'OPEN', url: 'https://example.com/5', headRefName: 'fix', body: 'Why', statusCheckRollup: [{ name: 'test', conclusion: 'FAILURE', detailsUrl: 'https://github.com/o/r/actions/runs/1/job/42' }] }));
else if (a === 'run' && b === 'view') console.log('test.ts:3 AssertionError');
else if (a === 'issue' && b === 'view') console.log(JSON.stringify({ number: 7, title: 'Bug', state: 'OPEN', body: 'Steps', comments: [{ author: { login: 'me' }, body: 'Seen again' }] }));
else { console.error('unknown'); process.exit(1); }`);
  process.env.AI_WORKSPACE_GH = fake;
  try {
    assert.equal(await readRepo(dir, { action: 'prs' }), '#5 OPEN fix 2026-10-20: Fix it');
    const pr = await readRepo(dir, { action: 'pr', number: 5, logs: true });
    assert.match(pr, /Checks:\n- test: FAILURE[\s\S]*Failed lines of test:\ntest\.ts:3 AssertionError/);
    assert.match(await readRepo(dir, { action: 'issue', number: 7 }), /#7 OPEN: Bug\n\nSteps\n\n--- me:\nSeen again/);
    await assert.rejects(readRepo(dir, { action: 'issues' }), /gh issue list failed \(is gh installed and logged in\?\): unknown/);
  } finally {
    delete process.env.AI_WORKSPACE_GH;
  }
});
