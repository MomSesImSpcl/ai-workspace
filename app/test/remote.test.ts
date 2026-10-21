// "Open in GitHub" (or another host) in the project menu: the web page of a project's git remote.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectWeb, webOf } from '../src/remote.ts';

test('remote addresses become web pages named after their site; sign-in data never passes', () => {
  const gh = { url: 'https://github.com/owner/repo', site: 'GitHub' };
  assert.deepEqual(webOf('https://github.com/owner/repo.git'), gh);
  assert.deepEqual(webOf('git@github.com:owner/repo.git\n'), gh);
  assert.deepEqual(webOf('ssh://git@github.com:22/owner/repo.git'), gh);
  assert.deepEqual(webOf('https://user:ghp_secret@github.com/owner/repo'), gh, 'the token is dropped');
  assert.deepEqual(webOf('git@gitlab.com:group/sub/repo.git'), { url: 'https://gitlab.com/group/sub/repo', site: 'GitLab' });
  assert.deepEqual(webOf('https://gitlab.example.com/team/repo.git'), { url: 'https://gitlab.example.com/team/repo', site: 'GitLab' });
  assert.deepEqual(webOf('git@bitbucket.org:team/repo.git'), { url: 'https://bitbucket.org/team/repo', site: 'Bitbucket' });
  assert.deepEqual(webOf('git@ssh.dev.azure.com:v3/org/proj/repo'), { url: 'https://dev.azure.com/org/proj/_git/repo', site: 'Azure DevOps' });
  assert.deepEqual(webOf('https://org@dev.azure.com/org/proj/_git/repo'), { url: 'https://dev.azure.com/org/proj/_git/repo', site: 'Azure DevOps' });
  assert.deepEqual(webOf('https://codeberg.org/me/repo.git'), { url: 'https://codeberg.org/me/repo', site: 'Codeberg' });
  assert.deepEqual(webOf('git@git.example.com:me/repo.git'), { url: 'https://git.example.com/me/repo', site: 'git.example.com' });
  for (const local of ['/srv/git/repo.git', 'C:\\repos\\repo', 'file:///srv/git/repo.git', '../other', '']) assert.equal(webOf(local), undefined, local);
});

test('a project folder gives its origin, else its first remote, and nothing without git or a remote', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ws-remote-'));
  const git = (...a: string[]) => spawnSync('git', a, { cwd: dir });
  assert.equal(projectWeb(dir), undefined, 'not a git folder');
  git('init', '-q');
  assert.equal(projectWeb(dir), undefined, 'no remote');
  git('remote', 'add', 'upstream', 'git@github.com:other/repo.git');
  assert.deepEqual(projectWeb(dir), { url: 'https://github.com/other/repo', site: 'GitHub' });
  git('remote', 'add', 'origin', 'https://gitlab.com/me/repo.git');
  assert.deepEqual(projectWeb(dir), { url: 'https://gitlab.com/me/repo', site: 'GitLab' });
});
