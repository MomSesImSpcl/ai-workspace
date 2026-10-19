// Git worktree per session, so agents never edit the checkout a running app is started from (selfdev-001).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
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
 * the app project; a `name` plans a new one with that branch and folder name (made at the first turn), refused
 * when empty, invalid or taken; a `path` continues an existing workspace-made worktree, for example after a
 * session's cache went cold, and any other path is refused.
 */
export function planWorktree(project: Project, sessionId: string, choice: WorktreeChoice = {}): Worktree | undefined {
  if (!isAppProject(project)) return undefined;
  if (choice.path) {
    const found = listWorktrees(project).find((w) => w.path.toLowerCase() === resolve(choice.path!).toLowerCase());
    if (!found) throw new Error(`Not a worktree of project ${project.id}: ${choice.path}`);
    return found;
  }
  if (choice.name === undefined) return { path: join(worktreesDir(project), sessionId), branch: `aiws/${sessionId}` };
  const name = choice.name.trim();
  if (!name) throw new Error('Enter a name for the new branch.');
  if (!WORKTREE_NAME.test(name) || name.endsWith('.lock') || name.includes('..')) throw new Error(`"${name}" is not a valid branch name: use letters, digits, ".", "_" and "-", starting with a letter or digit (at most 60 characters).`);
  const path = join(worktreesDir(project), name);
  if (existsSync(path) || branchExists(project.root, name)) throw new Error(`A branch named "${name}" already exists: pick another name, or continue it from the list.`);
  return { path, branch: name };
}

/** Allowed worktree names: also the branch and folder name, so safe for git refs and every file system. */
const WORKTREE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,59}$/;

/** Whether a local branch of that name exists in the repository at `root`. */
function branchExists(root: string, name: string): boolean {
  try { git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]); return true; } catch { return false; }
}

/**
 * How a new chat in the app project picks its worktree: `name` makes a new one with that branch and folder
 * name, `path` continues an existing one. Neither (tasks, the command line) makes one named after the session.
 */
export interface WorktreeChoice { name?: string; path?: string }

/**
 * A worktree's state against the project checkout's HEAD (normally `main`), read from git: `merged` when the
 * branch has commits of its own and all of them are in HEAD (a fresh branch without commits is not merged, so
 * the cleanup never takes it); `ahead` counts commits not in HEAD; `dirty` when the folder has uncommitted
 * changes. The branch's start comes from its reflog; without one it never counts as merged. A squash-merged
 * branch stays "ahead" and is left to the user.
 */
export function worktreeState(root: string, wt: Worktree): { merged: boolean; ahead: number; dirty: boolean } {
  const ref = `refs/heads/${wt.branch}`;
  let ahead = 0, merged = false, dirty = false;
  try { ahead = Number(git(root, ['rev-list', '--count', `HEAD..${ref}`])); } catch { /* branch gone */ }
  try {
    const created = git(root, ['reflog', 'show', '--format=%H', ref]).split('\n').at(-1);
    const tip = git(root, ['rev-parse', ref]);
    merged = !!created && tip !== created && ahead === 0;
  } catch { /* no reflog: never merged */ }
  try { dirty = git(wt.path, ['status', '--porcelain']) !== ''; } catch { /* folder gone */ }
  return { merged, ahead, dirty };
}

/** Removes a worktree folder and its branch. Without `force`, git refuses uncommitted changes or unmerged commits. */
export function deleteWorktree(root: string, wt: Worktree, force = false): void {
  git(root, ['worktree', 'remove', ...(force ? ['--force'] : []), wt.path]);
  git(root, ['branch', force ? '-D' : '-d', wt.branch]);
}

/**
 * The folders an agent must not write to (selfdev-002, ADR 0015): the checkout the running app starts from and
 * the workspace's storage. The session's own folder (`allow`) stays writable, also inside them, as a worktree in
 * storage is. Checked by `app/src/guard-hook.ts` for Claude Code and by the approval relay for Codex.
 */
export interface Guard { allow: string; deny: string[] }

/** The guard for an agent working in `root`. */
export function guardFor(root: string): Guard {
  return { allow: resolve(root), deny: [appRepo(), home()].filter((d): d is string => !!d).map((d) => resolve(d)) };
}

/** Whether `p` is the folder `dir` or inside it, case-insensitively since Windows paths are. */
const inside = (dir: string, p: string) => {
  const d = dir.toLowerCase(), q = p.toLowerCase();
  return q === d || q.startsWith(d.endsWith(sep) ? d : d + sep);
};

/** Git Bash spells `C:\x` as `/c/x`. */
const fromMsys = (p: string) => (sep === '\\' ? p.replace(/^\/([a-z])(?=\/|$)/i, '$1:') : p);

/**
 * The guarded folder a write to `path` (relative to `cwd`) would land in, or `undefined`. The deepest folder
 * containing it decides: the session's own folder wins inside storage, the checkout wins inside a project
 * folder that contains it, and a tie is guarded.
 */
export function guardedPath(g: Guard, path: string, cwd = g.allow): string | undefined {
  const p = resolve(cwd, fromMsys(path));
  const hit = g.deny.filter((d) => inside(d, p)).sort((a, b) => b.length - a.length)[0];
  return hit && !(inside(g.allow, p) && g.allow.length > hit.length) ? hit : undefined;
}

/** Like `guardedPath`, for write access to a whole folder: also guarded when a guarded folder lies inside it. */
export function guardedTree(g: Guard, dir: string, cwd = g.allow): string | undefined {
  const d = resolve(cwd, fromMsys(dir));
  return guardedPath(g, d) ?? g.deny.find((x) => inside(d, x));
}

/** A shell command's words, with quotes removed and operators (`;&|<>()`) as separators; `\ ` is an escaped space. */
function words(command: string): string[] {
  const out: string[] = [];
  let word = '', quote = '', any = false;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) { if (c === quote) quote = ''; else word += c; continue; }
    if (c === '"' || c === "'") { quote = c; any = true; continue; }
    if (c === '\\' && command[i + 1] === ' ') { word += ' '; i++; continue; }
    if (/[\s;&|<>()]/.test(c)) { if (word || any) out.push(word); word = ''; any = false; continue; }
    word += c;
  }
  if (word || any) out.push(word);
  return out;
}

/** A path as it may be written in a command: lower case, forward slashes, no doubled ones. */
const spelled = (s: string) => s.toLowerCase().replaceAll('\\ ', ' ').replaceAll('\\', '/').replace(/\/{2,}/g, '/');

/** The ways a folder is written in a command: as is and, for Git Bash, `/c/...`. */
const spellings = (dir: string) => {
  const d = spelled(dir).replace(/\/$/, '');
  return /^[a-z]:/.test(d) ? [d, `/${d[0]}${d.slice(2)}`] : [d];
};

/** Matches a folder's spelling where a path to it or into it can stand (not a longer folder name). */
const spellingRe = (s: string) => new RegExp(`${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.-])`, 'g');

/**
 * The guarded folder a shell command names or runs in, or `undefined` (selfdev-002). Path-like words are resolved
 * against `cwd`, with `~` and `$HOME` expanded, so `../..` out of the session's folder counts; paths inside quoted
 * code (`node -e "..."`) are found by their spelling. Best effort: a path computed at run time (variables,
 * scripts) is not seen; Codex's sandbox is the hard limit there, Claude Code has none on Windows.
 */
export function guardedCommand(g: Guard, command: string, cwd = g.allow): string | undefined {
  const atCwd = guardedPath(g, cwd);
  if (atCwd) return atCwd;
  const user = homedir();
  for (const word of words(command)) {
    for (const part of word.split('=')) {
      const w = part.replace(/^(~|\$HOME|\$\{HOME\}|\$env:USERPROFILE|%USERPROFILE%)(?=[\\/]|$)/i, user);
      if (!/[\\/]/.test(w) && w !== '..') continue;
      const hit = guardedPath(g, w, cwd);
      if (hit) return hit;
    }
  }
  let text = spelled(command);
  for (const s of spellings(g.allow)) text = text.replace(spellingRe(s), '\0');
  return g.deny.find((d) => spellings(d).some((s) => spellingRe(s).test(text)));
}

/** Makes a planned worktree: a new branch from the checkout's HEAD in `root`. Returns the commit it starts from ("<hash> <subject>"). */
export function addWorktree(root: string, wt: Worktree): string {
  mkdirSync(dirname(wt.path), { recursive: true });
  git(root, ['worktree', 'add', '-b', wt.branch, wt.path, 'HEAD']);
  return git(wt.path, ['log', '-1', '--format=%h %s']);
}
