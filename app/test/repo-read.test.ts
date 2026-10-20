// read_repo (#31): commit history through git, pull requests and issues through gh, read only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
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
