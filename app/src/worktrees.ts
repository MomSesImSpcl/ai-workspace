// Git worktree per session, so agents never edit the checkout a running app is started from (selfdev-001).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync, rmSync, statSync } from 'node:fs';
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
  base?: 'origin/main'; // a continued chat's new branch starts from freshly fetched origin/main, not the checkout's HEAD (#62)
}

/** Runs git in `cwd` and returns its trimmed output; a failure throws with git's own message. */
export function git(cwd: string, args: string[]): string {
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

/** Whether `path` is a worktree folder the workspace keeps for `project` (directly in its worktrees folder): binding ownership (#62). */
export const ownWorktreePath = (project: Project, path: string) => same(dirname(resolve(path)), worktreesDir(project));

/**
 * What git has checked out in the folder `path` as a worktree of the repository at `root`: its branch (undefined for
 * a detached HEAD) and HEAD commit. Undefined when git does not list the folder as one of that repository's
 * worktrees (a plain folder, another repository's worktree). Read by `bindingProblem` in app/src/binding.ts (#62).
 */
export function checkedOut(root: string, path: string): { branch?: string; head: string } | undefined {
  if (!existsSync(path)) return undefined;
  const all: { path: string; head: string; branch?: string }[] = [];
  for (const line of git(root, ['worktree', 'list', '--porcelain']).split('\n')) {
    if (line.startsWith('worktree ')) all.push({ path: line.slice('worktree '.length).trim(), head: '' });
    else if (line.startsWith('HEAD ') && all.length) all.at(-1)!.head = line.slice('HEAD '.length).trim();
    else if (line.startsWith('branch refs/heads/') && all.length) all.at(-1)!.branch = line.slice('branch refs/heads/'.length).trim();
  }
  const want = real(path);
  const hit = all.find((w) => existsSync(w.path) && real(w.path) === want);
  return hit && { branch: hit.branch, head: hit.head };
}

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
export function branchExists(root: string, name: string): boolean {
  try { git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]); return true; } catch { return false; }
}

/**
 * How a new chat in the app project picks its worktree: `name` makes a new one with that branch and folder
 * name, `path` continues an existing one. Neither (tasks, the command line) makes one named after the session.
 */
export interface WorktreeChoice { name?: string; path?: string }

/**
 * A worktree's state against the project checkout's HEAD (normally `main`), read from git: `merged` when the
 * branch has commits of its own and nothing in it is missing from HEAD: all its commits are in HEAD, or, after a
 * squash merge (the only way into `main`, ADR 0016), merging it into HEAD would change nothing (`mergesIntoHead`,
 * #24). A fresh branch without commits is not merged, so the cleanup never takes it. `ahead` counts commits not
 * in HEAD (a squash-merged branch keeps them); `dirty` when the folder has uncommitted changes. The branch's
 * start comes from its reflog; without one it never counts as merged.
 */
export function worktreeState(root: string, wt: Worktree): { merged: boolean; ahead: number; dirty: boolean } {
  const ref = `refs/heads/${wt.branch}`;
  let ahead = 0, merged = false, dirty = false;
  try { ahead = Number(git(root, ['rev-list', '--count', `HEAD..${ref}`])); } catch { /* branch gone */ }
  try {
    const created = git(root, ['reflog', 'show', '--format=%H', ref]).split('\n').at(-1);
    const tip = git(root, ['rev-parse', ref]);
    merged = !!created && tip !== created && (ahead === 0 || mergesIntoHead(root, ref));
  } catch { /* no reflog: never merged */ }
  try { dirty = git(wt.path, ['status', '--porcelain']) !== ''; } catch { /* folder gone */ }
  return { merged, ahead, dirty };
}

/**
 * The changed and untracked files of a checkout (`git status`) with their modification times: taken before and
 * after each agent turn in the app project, so a write into the running app's checkout that the write guard missed
 * (a path computed at run time, #18) is reported in the chat. `undefined` when git cannot read it.
 */
export function checkoutSnapshot(root: string): Map<string, number> | undefined {
  try {
    // Not through git(): its trim would cut the status column of the first entry (" M a.txt").
    const r = spawnSync('git', ['status', '--porcelain=v1', '-uall', '-z'], { cwd: root, encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) return undefined;
    const out = r.stdout;
    const files = new Map<string, number>();
    const entries = out.split('\0');
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]!;
      if (e.length < 4) continue;
      const path = e.slice(3);
      if (/^[RC]/.test(e)) i++; // a rename or copy is followed by its old path
      let mtime = -1; // deleted
      try { mtime = statSync(join(root, path)).mtimeMs; } catch { /* gone */ }
      files.set(path, mtime);
    }
    return files;
  } catch { return undefined; }
}

/** Files that changed between two `checkoutSnapshot`s: new, changed again, or back to the committed state. */
export function checkoutChanges(before: Map<string, number>, after: Map<string, number>): string[] {
  const changed = [...after].filter(([p, t]) => before.get(p) !== t).map(([p]) => p);
  return [...changed, ...[...before.keys()].filter((p) => !after.has(p))].sort();
}

/**
 * Whether merging branch `ref` into the checkout's HEAD would leave HEAD's files as they are, so nothing of the
 * branch is missing from it: true after a squash merge, false while any change of the branch (a later commit, or
 * one reverted in HEAD since) would still arrive. A test merge in git's object store (`git merge-tree
 * --write-tree`, git 2.38 or newer); no files change. A conflict, or an older git, counts as not merged.
 */
function mergesIntoHead(root: string, ref: string): boolean {
  try { return git(root, ['merge-tree', '--write-tree', 'HEAD', ref]).split('\n')[0] === git(root, ['rev-parse', 'HEAD^{tree}']); } catch { return false; }
}

/**
 * Removes a worktree folder and its branch. Without `force`, git refuses uncommitted changes. The branch itself is
 * always deleted with `-D`: git's own merged check misses squash merges, so callers decide by `worktreeState`
 * (`cleanupBranches` and `removeBranch` in app/src/branches.ts).
 */
export function deleteWorktree(root: string, wt: Worktree, force = false): void {
  git(root, ['worktree', 'remove', ...(force ? ['--force'] : []), wt.path]);
  git(root, ['branch', '-D', wt.branch]);
  try { rmSync(testHome(wt.branch), { recursive: true, force: true }); } catch { /* its test instance still open: the folder stays */ } // selfdev-009
}

/** The storage folder of a branch's test instance (selfdev-009), one per branch. */
export const testHome = (branch: string) => join(home(), 'test', branch.replace(/[^\w.-]/g, '_'));

/**
 * The folders an agent must not write to (selfdev-002, ADR 0015): the checkout the running app starts from and
 * the workspace's storage. The session's own folder (`allow`) stays writable, also inside them, as a worktree in
 * storage is. Checked by `app/src/guard-hook.ts` for Claude Code and by the approval relay for Codex.
 */
export interface Guard { allow: string; deny: string[]; merge?: boolean } // merge: also block `gh pr merge` (selfdev-004)

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
 * The folders in the checkout's `.git` that a commit in the worktree at `path` writes to (selfdev-002, ADR 0015): the
 * worktree's own git folder, the object store, and the branch refs and their logs. Not `hooks` or `config`, so an
 * agent cannot leave code that runs in the checkout. Given to Codex's sandbox as writable, so commits need no approval.
 */
export function commitRoots(path: string): string[] {
  const own = resolve(path, git(path, ['rev-parse', '--git-dir']));
  const common = resolve(path, git(path, ['rev-parse', '--git-common-dir']));
  return [own, join(common, 'objects'), join(common, 'refs', 'heads'), join(common, 'logs', 'refs', 'heads')].filter((d) => existsSync(d));
}

/** Starts every notice of a blocked write, so the Claude Code adapter finds it in the hook's deny reason. */
export const GUARD_MARK = 'Blocked by the write guard (selfdev-002)';

/**
 * The chat notice for a blocked write (selfdev-002): what was blocked and, for a command, how a reading one is let
 * through, so the user can check it and extend the read list.
 */
export function guardNotice(hit: string, what: { command?: string; file?: string }): string {
  if (what.file) return `${GUARD_MARK}: writing ${what.file} would change ${hit}.`;
  return `${GUARD_MARK}: the command \`${what.command}\` would run in or name ${hit}. If it only reads, add its program to the read list (\`READERS\` or \`GIT_READERS\` in app/src/worktrees.ts).`;
}

/** Programs that only read, so a command of them alone may name or run in a guarded folder (user, 2026-10-19). */
const READERS = new Set(['cd', 'pushd', 'popd', 'pwd', 'ls', 'dir', 'cat', 'type', 'head', 'tail', 'wc', 'grep', 'egrep', 'fgrep', 'rg', 'findstr', 'find', 'stat', 'du', 'diff', 'cmp', 'echo', 'realpath', 'readlink', 'basename', 'dirname', 'md5sum', 'sha1sum', 'sha256sum', 'which', 'where', 'true', 'test', 'get-content', 'gc', 'get-childitem', 'gci', 'get-item', 'gi', 'select-string', 'sls', 'test-path', 'resolve-path', 'get-location', 'set-location', 'measure-object', 'select-object', 'git', 'sort', 'uniq', 'cut', 'tr', 'nl', 'date', 'read']);
/** Git subcommands that only read; `branch`, `remote` and `reflog` only when they list. */
const GIT_READERS = new Set(['log', 'show', 'diff', 'status', 'rev-parse', 'ls-files', 'ls-tree', 'blame', 'grep', 'cat-file', 'describe', 'shortlog', 'merge-base', 'rev-list', 'branch', 'remote', 'reflog']);
/** Shell words that start or end a loop or branch; the command after them is checked on its own (sed and awk stay off the list: their scripts can write and run commands). */
const KEYWORDS = new Set(['do', 'done', 'then', 'else', 'elif', 'fi', 'while', 'until', 'if', '!', '{', '}']);
/** Options that make a reader write or run something: find's actions, ripgrep's preprocessor, git's output file or pager. */
const WRITING_OPTION = /^(-delete|-exec|-execdir|-ok|-okdir|-fprint|-fprint0|-fprintf|-fls|--pre|--output|-O|--open-files-in-pager)(=|$)/;

/**
 * A command's parts split at `;`, `&`, `|`, newlines and parentheses, or `undefined` when it substitutes a command
 * (`$(...)`, backticks) or redirects output to a file (a redirect to null or to another stream is fine).
 */
function parts(command: string): string[][] | undefined {
  const out: string[][] = [];
  let part: string[] = [], word = '', quote = '', any = false;
  const end = () => { if (word || any) part.push(word); word = ''; any = false; };
  for (let i = 0; i < command.length; i++) {
    const c = command[i]!;
    if (quote) {
      if (c === quote) quote = '';
      else if (quote === '"' && (c === '`' || (c === '$' && command[i + 1] === '('))) return undefined;
      else word += c;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; any = true; continue; }
    if (c === '`' || (c === '$' && command[i + 1] === '(')) return undefined;
    if (c === '>') {
      const sink = /^>?\s*(&\d|\/dev\/null(?![\w./-])|nul(?![\w./-])|\$null(?![\w./-]))/i.exec(command.slice(i + 1));
      if (!sink) return undefined;
      if (/^\d$/.test(word)) word = ''; // the `2` of `2>`
      end();
      i += sink[0].length;
      continue;
    }
    if (/[;&|()\n]/.test(c)) { end(); if (part.length) out.push(part); part = []; continue; }
    if (/\s/.test(c) || c === '<') { end(); continue; }
    word += c;
  }
  end();
  if (part.length) out.push(part);
  return out;
}

/** Whether every part of a shell command only reads (Bash, Git Bash, PowerShell or cmd spelling). */
export function readOnlyCommand(command: string): boolean {
  const all = parts(command);
  return !!all?.every((p) => {
    let w = p.filter((x, i) => !p.slice(0, i + 1).every((y) => /^\w+=/.test(y))); // without leading `VAR=value`
    while (w.length && KEYWORDS.has(w[0]!)) w = w.slice(1);
    if (!w.length) return true;
    if (w[0] === 'for') return w[2] === 'in' || w.length === 2; // `for f in a b`: only words; substitutions were refused above
    const prog = basename(w[0]!.replaceAll('\\', '/')).toLowerCase().replace(/\.exe$/, '');
    if (!READERS.has(prog) || w.some((x) => WRITING_OPTION.test(x))) return false;
    const args = w.slice(1).filter((x) => !x.startsWith('-'));
    if (prog === 'sort') return !w.some((x) => /^-\w*o/.test(x) && !x.startsWith('--')); // `-o FILE` writes
    if (prog === 'uniq') return args.length <= 1; // `uniq IN OUT` writes OUT
    if (prog === 'date') return !w.some((x) => /^(-\w*s|--set)/.test(x)); // sets the clock
    if (prog !== 'git') return true;
    // Git's own options before the subcommand; `-c` can set a command to run, so it does not count as reading.
    let i = 1;
    while (w[i] === '-C' || w[i] === '--no-pager' || w[i]?.startsWith('--git-dir=') || w[i]?.startsWith('--work-tree=')) i += w[i] === '-C' ? 2 : 1;
    const sub = w[i], rest = w.slice(i + 1);
    if (!sub || !GIT_READERS.has(sub)) return false;
    if (sub === 'branch') return rest.every((x) => /^(-a|-r|-v|-vv|--all|--remotes|--list|--show-current|--merged|--no-merged|--contains)$/.test(x));
    if (sub === 'remote') return rest.every((x) => x === '-v');
    if (sub === 'reflog') return !rest.length || rest[0] === 'show' || rest[0]!.startsWith('-'); // not expire or delete
    return true;
  });
}

/**
 * The guarded folder a shell command names or runs in, or `undefined` (selfdev-002). A command that only reads
 * (`readOnlyCommand`) passes. Path-like words are resolved
 * against `cwd`, with `~` and `$HOME` expanded, so `../..` out of the session's folder counts; paths inside quoted
 * code (`node -e "..."`) are found by their spelling. Best effort: a path computed at run time (variables,
 * scripts) is not seen; Codex's sandbox is the hard limit there, Claude Code has none on Windows.
 */
export function guardedCommand(g: Guard, command: string, cwd = g.allow): string | undefined {
  if (readOnlyCommand(command)) return undefined;
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

/**
 * How npm is started with `args`, as `[command, arguments, shell]` for `spawn`: `AI_WORKSPACE_NPM` (a script runs
 * with this Node; tests use a fake), else `npm`. On Windows npm is a .cmd script that needs the shell; there the
 * whole command is one string, since Node deprecates arguments next to `shell: true` (DEP0190). The arguments are
 * the app's own fixed words, never user input.
 */
export function npmCommand(args: string[], platform: NodeJS.Platform = process.platform): [string, string[], boolean] {
  const bin = process.env.AI_WORKSPACE_NPM;
  if (bin) return /\.(m?js|ts)$/.test(bin) ? [process.execPath, [bin, ...args], false] : [bin, args, false];
  return platform === 'win32' ? [['npm', ...args].join(' '), [], true] : ['npm', args, false];
}

/**
 * Installs a new worktree's npm dependencies (#26): `npm ci` in its root and in `app/` where a `package-lock.json`
 * is, run by the app outside any agent sandbox with the user's normal npm cache, so the agent can run typecheck and
 * tests at once. Electron's binary is skipped as in CI: a branch's test instance (selfdev-009) runs on the running app's Electron.
 * `notice` tells the chat; a failure is reported with npm's last lines and does not stop the session.
 */
export async function installDependencies(path: string, notice: (text: string) => void): Promise<void> {
  for (const dir of [path, join(path, 'app')].filter((d) => existsSync(join(d, 'package-lock.json')))) {
    const where = dir === path ? 'the worktree' : 'app/';
    notice(`Installing dependencies in ${where} (npm ci)…`);
    const started = Date.now();
    const [cmd, argv, shell] = npmCommand(['ci', '--no-audit', '--no-fund']);
    const { code, output } = await new Promise<{ code: number | null; output: string }>((done) => {
      let output = '';
      const child = spawn(cmd, argv, { cwd: dir, shell, windowsHide: true, env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '1' } });
      child.stdout.on('data', (d) => (output += d));
      child.stderr.on('data', (d) => (output += d));
      child.on('error', (e) => done({ code: -1, output: e.message }));
      child.on('close', (c) => done({ code: c, output }));
    });
    const lines = output.trim().split(/\r?\n/).slice(-5).join('\n');
    notice(code === 0 ? `Dependencies installed in ${where} (${Math.round((Date.now() - started) / 1000)} s).`
      : `Installing dependencies in ${where} failed (npm ci, exit ${code}); the agent can run \`npm ci\` itself. npm said:\n${lines}`);
  }
}

/**
 * Makes a planned worktree: a new branch from the checkout's HEAD in `root`, or, for a continued chat (`base`, #62),
 * from `origin/main` fetched just before, since the running checkout may lag behind main. A failed fetch makes nothing.
 * Returns the commit it starts from ("<hash> <subject>").
 */
export function addWorktree(root: string, wt: Worktree): string {
  const had = branchExists(root, wt.branch);
  if (wt.base && !had) {
    try { git(root, ['fetch', 'origin', 'main']); } catch (e) { throw new Error(`Fetching origin/main for the new branch ${wt.branch} failed, so nothing was made; send the message again to retry. ${(e as Error).message}`); }
  }
  try {
    mkdirSync(dirname(wt.path), { recursive: true });
    // Long paths let Windows Git check out files deeper than 260 characters, when the system allows them.
    // An existing branch (its folder was removed but not the branch) is checked out again, not made anew.
    // --no-track: a branch from origin/main must not track main, or it would count as published (`bindingProblem`).
    git(root, ['-c', 'core.longpaths=true', 'worktree', 'add', ...(had ? [wt.path, wt.branch] : wt.base ? ['--no-track', '-b', wt.branch, wt.path, wt.base] : ['-b', wt.branch, wt.path, 'HEAD'])]);
  } catch (e) {
    // Git makes the branch before the folder, so a failure leaves the branch behind (#22).
    try { git(root, ['worktree', 'prune']); } catch { /* nothing to prune */ }
    if (!had && branchExists(root, wt.branch)) try { git(root, ['branch', '-D', wt.branch]); } catch { /* still in use */ }
    const message = (e as Error).message;
    if (/too big|too long|ENAMETOOLONG|could not create leading directories|Invalid path/i.test(message)) {
      throw new Error(`The new worktree could not be made, most likely because its folder path is too long (${wt.path.length} characters${process.platform === 'win32' ? '; Git on Windows often stops at 260' : ''}): ${wt.path}. Use a shorter branch name, or move the workspace storage to a shorter folder (AI_WORKSPACE_HOME). No branch was left behind. Git said: ${message}`);
    }
    throw e;
  }
  return git(wt.path, ['log', '-1', '--format=%h %s']);
}
