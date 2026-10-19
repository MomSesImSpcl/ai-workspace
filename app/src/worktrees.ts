// Git worktree per session, so agents never edit the checkout a running app is started from (selfdev-001).
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { home, type Project } from './store.ts';

/**
 * A session's own worktree and branch, planned when the session is created and made at its first turn.
 * `ready` tells a worktree not made yet apart from one the agent removed after merging (selfdev-001).
 */
export interface Worktree {
  path: string; // under the workspace's storage (`<home>/worktrees/<project>/<session>`), outside the repository
  branch: string; // `aiws/<session id>`, cut from the project checkout's HEAD
  ready?: boolean;
}

/** Runs git in `cwd` and returns its trimmed output; a failure throws with git's own message. */
function git(cwd: string, args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed in ${cwd}: ${(r.stderr || r.error?.message || '').trim()}`);
  return r.stdout.trim();
}

/** Git root folders by folder, compared case-insensitively since Windows paths are; `undefined` outside a repository. */
const roots = new Map<string, string | undefined>();
function gitRoot(dir: string): string | undefined {
  if (!roots.has(dir)) {
    let root: string | undefined;
    try { root = resolve(git(dir, ['rev-parse', '--show-toplevel'])).toLowerCase(); } catch { /* not a repository */ }
    roots.set(dir, root);
  }
  return roots.get(dir);
}

/**
 * Whether new sessions of a project work in their own worktree: the project's own switch, else on for the
 * repository this running app is started from, since its agents would otherwise edit the live app.
 */
export function worktreesOn(project: Project): boolean {
  if (project.worktrees !== undefined) return project.worktrees;
  const app = gitRoot(dirname(fileURLToPath(import.meta.url)));
  return !!app && gitRoot(project.root) === app;
}

/** The worktree a new session of this project gets (`createSession` in `app/src/sessions.ts`), or none when its switch is off. Nothing is made yet. */
export function planWorktree(project: Project, sessionId: string): Worktree | undefined {
  if (!worktreesOn(project)) return undefined;
  return { path: join(home(), 'worktrees', project.id, sessionId), branch: `aiws/${sessionId}` };
}

/** Makes a planned worktree: a new branch from the checkout's HEAD in `root`. Returns the commit it starts from ("<hash> <subject>"). */
export function addWorktree(root: string, wt: Worktree): string {
  mkdirSync(dirname(wt.path), { recursive: true });
  git(root, ['worktree', 'add', '-b', wt.branch, wt.path, 'HEAD']);
  return git(wt.path, ['log', '-1', '--format=%h %s']);
}
