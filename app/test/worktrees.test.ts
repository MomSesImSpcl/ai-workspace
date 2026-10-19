// Worktree per session (selfdev-001): planned at creation, made at the first turn, shared with the chat's tasks,
// and a removed worktree stops the session instead of falling back to the live checkout.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addMessage, createSession, loadSession, readEvents, type SessionAgent } from '../src/sessions.ts';
import { createTask } from '../src/tasks.ts';
import { runTurn } from '../src/turn.ts';
import { getProject, registerProject, setProjectWorktrees } from '../src/store.ts';
import { isGitRepo, listWorktrees, planWorktree, worktreesOn } from '../src/worktrees.ts';

let root = '';
const git = (...args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim();
beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'ws-worktrees-'));
  process.env.AI_WORKSPACE_HOME = join(dir, 'home');
  process.env.AI_WORKSPACE_SESSION_IDLE_MS = '300';
  root = join(dir, 'project');
  mkdirSync(root);
  git('init', '-q', '-b', 'main');
  writeFileSync(join(root, 'a.txt'), 'a');
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'first');
  registerProject(root, 'P');
});

/** A fake agent that records the folder each run starts in. */
function recording(roots: string[]): Record<string, SessionAgent> {
  return { 'claude-code': { open: (_s, r) => { roots.push(r); return { turn: async () => ({}), close() {} }; }, permissions: () => ({ line: 'fake' }), catalog: () => ({ models: [] }), inventory: async () => [] } };
}

test('the switch is off for other repositories and on for the one this app runs from', () => {
  assert.equal(worktreesOn(getProject('P')), false);
  assert.equal(planWorktree(getProject('P'), 'x'), undefined);
  const appRepo = dirname(dirname(fileURLToPath(import.meta.url)));
  assert.equal(worktreesOn({ id: 'app', root: appRepo }), true);
  assert.equal(worktreesOn({ id: 'app', root: appRepo, worktrees: false }), false);
  const plain = mkdtempSync(join(tmpdir(), 'ws-plain-'));
  assert.equal(isGitRepo(plain), false);
  assert.equal(worktreesOn({ id: 'plain', root: plain, worktrees: true }), false); // a folder without git never gets worktrees
});

test('a new session can continue an existing worktree instead of making one', async () => {
  setProjectWorktrees('P', true);
  const first = createSession('P', 'Chat', { integration: 'claude-code' });
  addMessage(first.id, 'start');
  await runTurn(first.id, recording([]));
  const made = loadSession(first.id).worktree!;
  assert.deepEqual(listWorktrees(getProject('P')), [made]);
  const next = createSession('P', 'Chat', { integration: 'claude-code' }, made.path);
  assert.deepEqual(next.worktree, made);
  const roots: string[] = [];
  addMessage(next.id, 'go on');
  await runTurn(next.id, recording(roots));
  assert.deepEqual(roots, [made.path]);
  assert.equal(readEvents(next.id).filter((e) => e.type === 'notice').length, 0); // nothing new was made
  assert.throws(() => createSession('P', 'Chat', { integration: 'claude-code' }, root), /Not a worktree of project P/);
  rmSync(root, { recursive: true, force: true });
});

test('a session works in its own worktree from the first turn; its tasks share it; a removed one stops it', async () => {
  setProjectWorktrees('P', true);
  const chat = createSession('P', 'Chat', { integration: 'claude-code' });
  const wt = loadSession(chat.id).worktree!;
  assert.equal(existsSync(wt.path), false); // planned, not made until it is used
  const roots: string[] = [];
  addMessage(chat.id, 'start');
  await runTurn(chat.id, recording(roots));
  assert.deepEqual(roots, [wt.path]);
  assert.ok(existsSync(join(wt.path, 'a.txt')));
  assert.equal(git('branch', '--list', '--format=%(refname:short)', wt.branch), wt.branch);
  assert.ok(readEvents(chat.id).some((e) => e.type === 'notice' && e.text.includes(`branch ${wt.branch}, from `)));
  const t = createTask({ projectId: 'P', goal: 'edit', role: 'Implementation', sessionId: chat.id, setup: ['tool:Read'] });
  assert.deepEqual(t.worktree, { ...wt, ready: true });
  await runTurn(t.id, recording(roots));
  assert.equal(roots.at(-1), wt.path);
  git('worktree', 'remove', '--force', wt.path);
  addMessage(chat.id, 'again');
  await runTurn(chat.id, recording(roots));
  assert.equal(roots.length, 2); // no agent started in the live checkout
  assert.ok(readEvents(chat.id).some((e) => e.type === 'error' && /worktree is gone/.test(e.message)));
  rmSync(root, { recursive: true, force: true });
});
