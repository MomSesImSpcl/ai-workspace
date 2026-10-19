// Git worktree per session, so agents never edit the checkout a running app is started from (selfdev-001).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
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
  if (!isGitRepo(project.root)) return false; // nothing to branch from
  if (project.worktrees !== undefined) return project.worktrees;
  const app = gitRoot(dirname(fileURLToPath(import.meta.url)));
  return !!app && gitRoot(project.root) === app;
}

/** Whether a folder is inside a git repository, so the "New worktree per session" switch can apply to it. */
export const isGitRepo = (dir: string): boolean => !!gitRoot(dir);

/** Where the workspace keeps a project's worktrees. */
const worktreesDir = (project: Project) => join(home(), 'worktrees', project.id);

/**
 * The workspace-made worktrees of a project that still exist, newest git order first, read from
 * `git worktree list`: the choices besides "New worktree" when a session starts (selfdev-001). A worktree the
 * agent removed after merging drops out here.
 */
export function listWorktrees(project: Project): Worktree[] {
  if (!worktreesOn(project)) return [];
  const own = resolve(worktreesDir(project)).toLowerCase();
  const out: Worktree[] = [];
  let path: string | undefined;
  for (const line of git(project.root, ['worktree', 'list', '--porcelain']).split('\n')) {
    if (line.startsWith('worktree ')) path = resolve(line.slice('worktree '.length).trim());
    else if (line.startsWith('branch refs/heads/') && path && path.toLowerCase().startsWith(own) && existsSync(path)) out.push({ path, branch: line.slice('branch refs/heads/'.length).trim(), ready: true });
  }
  return out;
}

/**
 * The worktree a new session of this project gets (`createSession` in `app/src/sessions.ts`): none when the
 * switch is off; `'new'` plans a new one (made at the first turn); a path continues an existing workspace-made
 * worktree, for example after a session's cache went cold. Any other path is refused.
 */
export function planWorktree(project: Project, sessionId: string, choice = 'new'): Worktree | undefined {
  if (!worktreesOn(project)) return undefined;
  if (choice === 'new') return { path: join(worktreesDir(project), sessionId), branch: `aiws/${sessionId}` };
  const found = listWorktrees(project).find((w) => w.path.toLowerCase() === resolve(choice).toLowerCase());
  if (!found) throw new Error(`Not a worktree of project ${project.id}: ${choice}`);
  return found;
}

/** Makes a planned worktree: a new branch from the checkout's HEAD in `root`. Returns the commit it starts from ("<hash> <subject>"). */
export function addWorktree(root: string, wt: Worktree): string {
  mkdirSync(dirname(wt.path), { recursive: true });
  git(root, ['worktree', 'add', '-b', wt.branch, wt.path, 'HEAD']);
  return git(wt.path, ['log', '-1', '--format=%h %s']);
}
