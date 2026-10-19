// Git worktree per session, so agents never edit the checkout a running app is started from (selfdev-001).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { home, listProjects, registerProject, type Project } from './store.ts';

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

/** A folder's real path, lower-cased since Windows paths compare case-insensitively. */
const real = (dir: string) => realpathSync.native(dir).toLowerCase();

/** Same folder, compared case-insensitively since Windows paths are. */
const same = (a: string, b: string) => resolve(a).toLowerCase() === resolve(b).toLowerCase();

let appRoot: { dir?: string } | undefined;
/**
 * The repository the workspace develops itself in: the root of the git checkout this app runs from
 * (`AI_WORKSPACE_REPO` overrides it, for tests). `undefined` for a packaged app, which runs from no checkout,
 * so a release never gets the app project or worktrees.
 */
export function appRepo(): string | undefined {
  if (process.env.AI_WORKSPACE_REPO) return resolve(process.env.AI_WORKSPACE_REPO);
  if (!appRoot) {
    appRoot = {};
    try { appRoot.dir = resolve(git(dirname(fileURLToPath(import.meta.url)), ['rev-parse', '--show-toplevel'])); } catch { /* not a checkout */ }
  }
  return appRoot.dir;
}

/**
 * The app project: the one whose folder is the app's own repository (`appRepo`). Only its sessions work in
 * worktrees, so agents never edit the checkout the running app starts from; it cannot be removed and is listed
 * first (selfdev-001, ADR 0014).
 */
export function isAppProject(project: Project): boolean {
  const app = appRepo();
  return !!app && same(project.root, app);
}

/** Adds the app's repository as a project on start (`ui` in `app/src/cli.ts`), unless a project already has that folder. */
export function addAppProject(): Project | undefined {
  const app = appRepo();
  if (!app) return undefined;
  const projects = listProjects();
  const known = projects.find((p) => same(p.root, app));
  if (known) return known;
  const id = projects.some((p) => p.id === basename(app)) ? `${basename(app)} (workspace)` : basename(app);
  return registerProject(app, id);
}

/** Where the workspace keeps a project's worktrees. */
const worktreesDir = (project: Project) => join(home(), 'worktrees', project.id);

/**
 * The workspace-made worktrees of a project that still exist, newest git order first, read from
 * `git worktree list`: the choices besides "New worktree" when a session starts (selfdev-001). A worktree the
 * agent removed after merging drops out here.
 */
export function listWorktrees(project: Project): Worktree[] {
  if (!isAppProject(project)) return [];
  // Git reports real paths; the storage path can be spelled otherwise (Windows short names, macOS /var ->
  // /private/var), so both sides are compared as real paths and the result keeps the storage spelling.
  const dir = worktreesDir(project);
  if (!existsSync(dir)) return [];
  const own = real(dir) + sep;
  const out: Worktree[] = [];
  let path: string | undefined;
  for (const line of git(project.root, ['worktree', 'list', '--porcelain']).split('\n')) {
    if (line.startsWith('worktree ')) path = line.slice('worktree '.length).trim();
    else if (line.startsWith('branch refs/heads/') && path && existsSync(path) && real(path).startsWith(own)) out.push({ path: join(dir, basename(path)), branch: line.slice('branch refs/heads/'.length).trim(), ready: true });
  }
  return out;
}

/**
 * The worktree a new session of this project gets (`createSession` in `app/src/sessions.ts`): none outside
 * the app project; `'new'` plans a new one (made at the first turn); a path continues an existing workspace-made
 * worktree, for example after a session's cache went cold. Any other path is refused.
 */
export function planWorktree(project: Project, sessionId: string, choice = 'new'): Worktree | undefined {
  if (!isAppProject(project)) return undefined;
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
