// Restarting onto new code and falling back (selfdev-005/006, ADR 0018): updating the app's checkout from main,
// and the copy of the last version that passed its startup check, which the desktop shell (`app/desktop/main.mjs`)
// starts when a new version fails.
import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { home, readJson, writeJson } from './store.ts';
import { npmCommand } from './worktrees.ts';

/**
 * The last working version: a detached git worktree of `commit` in workspace storage (`<home>/last-good/<slot>`)
 * with its npm dependencies, Electron included. Two slots take turns, so a copy being built never replaces the
 * recorded one until it is complete. `electron` is the binary the desktop shell starts it with. Stored in
 * `<home>/last-good.json`, which `lastGood` in `app/desktop/main.mjs` reads too.
 */
export interface LastGood { commit: string; subject: string; slot: 'a' | 'b'; path: string; electron: string; at: string }

const stateFile = () => join(home(), 'last-good.json');
const lockFile = () => join(home(), 'last-good.lock');

/** Runs a program and collects its output; never throws (a start failure is exit -1). */
function run(cmd: string, args: string[], cwd: string, opts: { shell?: boolean; env?: NodeJS.ProcessEnv } = {}): Promise<{ code: number | null; out: string }> {
  return new Promise((done) => {
    let out = '';
    const child = spawn(cmd, args, { cwd, shell: opts.shell, env: opts.env, windowsHide: true });
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (e) => done({ code: -1, out: e.message }));
    child.on('close', (code) => done({ code, out: out.trim() }));
  });
}

/** Runs git in `cwd` and returns its output; a failure throws with git's own message. Async, so the UI server keeps answering during a fetch. */
async function git(cwd: string, args: string[]): Promise<string> {
  const r = await run('git', args, cwd);
  if (r.code !== 0) throw new Error(`git ${args[0]} failed: ${r.out}`);
  return r.out;
}

/** Runs npm (`npmCommand` in `app/src/worktrees.ts`) in `cwd`; `{ code, out }` with the last lines of its output. */
async function npm(args: string[], cwd: string): Promise<{ code: number | null; out: string }> {
  const [cmd, argv, shell] = npmCommand(args);
  const r = await run(cmd, argv, cwd, { shell });
  return { code: r.code, out: r.out.split(/\r?\n/).slice(-5).join('\n') };
}

const inside = (dir: string, path: string) => { const r = relative(resolve(dir), resolve(path)); return !r || (!r.startsWith('..') && !isAbsolute(r)); };

/** The Electron binary installed in an app folder (`node_modules/electron/path.txt` names it inside `dist/`), if any. */
export function electronIn(app: string): string | undefined {
  try {
    const bin = join(app, 'node_modules', 'electron', 'dist', readFileSync(join(app, 'node_modules', 'electron', 'path.txt'), 'utf8').trim());
    return existsSync(bin) ? bin : undefined;
  } catch { return undefined; }
}

/** The recorded last working version, if its copy still exists. */
export function lastGood(): LastGood | undefined {
  const s = readJson<LastGood | null>(stateFile(), null);
  return s && existsSync(s.path) ? s : undefined;
}

/** Removes a copy: its git worktree, then whatever is left of the folder. Best effort; a file still in use stays until the next try. */
async function removeCopy(repo: string, path: string): Promise<void> {
  if (!existsSync(path)) return;
  await git(repo, ['worktree', 'remove', '--force', path]).catch(() => {});
  try { rmSync(path, { recursive: true, force: true }); } catch { /* in use; removed next time */ }
  await git(repo, ['worktree', 'prune']).catch(() => {});
}

/**
 * Records `commit` of the app checkout `repo` as the last working version, after the desktop shell saw it pass its
 * startup check (selfdev-006): builds a fresh copy in the free slot (`git worktree add --detach`, then `npm ci` in
 * `app/` and Electron's own `install.js`, since Electron fetches its binary on first use), then switches
 * `last-good.json` to it and removes the older copy. Only `main` at that commit without changes in `app/` counts,
 * since anything else is not a version `main` can return to (notes or docs changed elsewhere do not matter); a
 * fallback instance (`AI_WORKSPACE_FALLBACK`) never records. One recorder at a time (`last-good.lock`, taken over
 * after an hour).
 * Returns what it did, for `last-good.log`; a failed build throws and leaves the recorded version as it was.
 */
export async function recordLastGood(repo: string, commit: string): Promise<string> {
  if (process.env.AI_WORKSPACE_FALLBACK || inside(home(), repo)) return 'skipped: this instance is itself a fallback';
  const branch = await git(repo, ['branch', '--show-current']);
  if (branch !== 'main') return `skipped: the checkout is on ${branch || 'a detached HEAD'}, not main`;
  if ((await git(repo, ['rev-parse', 'HEAD'])) !== commit) return `skipped: the checkout moved on from ${commit}`;
  // Only changes to the code that runs (app/) make the copy differ from it; notes or docs elsewhere do not.
  if (await git(repo, ['status', '--porcelain', '--untracked-files=no', '--', 'app'])) return 'skipped: app/ has uncommitted changes';
  const current = lastGood();
  if (current?.commit === commit) return `already recorded: ${commit}`;
  mkdirSync(home(), { recursive: true });
  try { if (Date.now() - statSync(lockFile()).mtimeMs > 3_600_000) unlinkSync(lockFile()); } catch { /* no lock */ }
  let lock: number;
  try { lock = openSync(lockFile(), 'wx'); } catch { return 'skipped: another recorder is running'; }
  try {
    const slot = current?.slot === 'a' ? 'b' : 'a';
    const path = join(home(), 'last-good', slot);
    await removeCopy(repo, path);
    mkdirSync(dirname(path), { recursive: true });
    // Long paths, as for session worktrees (`addWorktree` in app/src/worktrees.ts).
    await git(repo, ['-c', 'core.longpaths=true', 'worktree', 'add', '--detach', path, commit]);
    const app = join(path, 'app');
    if (existsSync(join(app, 'package-lock.json'))) {
      const r = await npm(['ci', '--no-audit', '--no-fund'], app);
      if (r.code !== 0) throw new Error(`npm ci failed in the copy (exit ${r.code}): ${r.out}`);
    }
    // Electron fetches its binary on first use, not at install, so the copy gets it now, while the network is fine.
    const installer = join(app, 'node_modules', 'electron', 'install.js');
    if (!electronIn(app) && existsSync(installer)) {
      const r = await run(process.execPath, [installer], app);
      if (r.code !== 0) throw new Error(`fetching Electron for the copy failed (exit ${r.code}): ${r.out.split(/\r?\n/).slice(-5).join('\n')}`);
    }
    const electron = electronIn(app);
    if (!electron) throw new Error('the copy has no Electron binary after npm ci');
    const subject = await git(repo, ['log', '-1', '--format=%s', commit]);
    writeJson(stateFile(), { commit, subject, slot, path, electron, at: new Date().toISOString() } satisfies LastGood);
    if (current) await removeCopy(repo, current.path);
    return `recorded ${commit} in ${path}`;
  } finally {
    closeSync(lock);
    try { unlinkSync(lockFile()); } catch { /* already gone */ }
  }
}

/**
 * Whether the app checkout can take new commits from `origin/main` (selfdev-005): `behind` and `ahead` count
 * commits against `origin/main` after a fetch; `dirty` means uncommitted changes to tracked files in `app/`. A failed fetch
 * (offline) is reported in `error`, with the counts from the last fetch.
 */
export interface UpdateStatus { branch: string; behind: number; ahead: number; dirty: boolean; error?: string; checkedAt: string }

/** Fetches `main` and compares the checkout `repo` with it. Never throws. */
export async function updateStatus(repo: string): Promise<UpdateStatus> {
  const s: UpdateStatus = { branch: '', behind: 0, ahead: 0, dirty: false, checkedAt: new Date().toISOString() };
  try {
    // No login prompt: a fetch that needs one fails at once instead of holding the Update check.
    const r = await run('git', ['fetch', '--quiet', 'origin', 'main'], repo, { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    if (r.code !== 0) s.error = `git fetch failed: ${r.out}`;
    s.branch = await git(repo, ['branch', '--show-current']);
    s.behind = Number(await git(repo, ['rev-list', '--count', 'HEAD..origin/main']));
    s.ahead = Number(await git(repo, ['rev-list', '--count', 'origin/main..HEAD']));
    // Changes outside app/ do not block an update: git's fast-forward refuses to overwrite a changed file itself.
    s.dirty = !!(await git(repo, ['status', '--porcelain', '--untracked-files=no', '--', 'app']));
  } catch (e) { s.error = (e as Error).message; }
  return s;
}

/**
 * Brings the app checkout up to date with `origin/main` before a restart onto the new code (selfdev-005):
 * a fast-forward only, refused on another branch, with uncommitted changes or with local commits, so the user's own
 * work is never merged or lost. When `app/package.json` or its lock changed, dependencies are installed with
 * `npm install --no-save`, which, unlike `npm ci`, leaves unchanged packages in place: the running Electron's files
 * are in use on Windows. Returns what happened; throws with a message for the user when nothing or only the code
 * could be updated.
 */
export async function applyUpdate(repo: string): Promise<{ from: string; to: string; dependencies: boolean }> {
  const s = await updateStatus(repo);
  if (s.error && !s.branch) throw new Error(s.error);
  if (s.branch !== 'main') throw new Error(`The app's checkout is on ${s.branch ? `branch ${s.branch}` : 'a detached HEAD'}, not main. Switch it back with \`git switch main\` first.`);
  if (s.dirty) throw new Error("The app's checkout has uncommitted changes in app/. Commit or remove them first.");
  if (s.ahead) throw new Error(`The app's checkout has ${s.ahead} commit(s) that are not on main. Move them to a branch first.`);
  const from = await git(repo, ['rev-parse', 'HEAD']);
  if (!s.behind) return { from, to: from, dependencies: false };
  await git(repo, ['merge', '--ff-only', 'origin/main']);
  const to = await git(repo, ['rev-parse', 'HEAD']);
  const changed = await git(repo, ['diff', '--name-only', from, to, '--', 'app/package.json', 'app/package-lock.json']);
  if (!changed) return { from, to, dependencies: false };
  const r = await npm(['install', '--no-save', '--no-audit', '--no-fund'], join(repo, 'app'));
  if (r.code !== 0) throw new Error(`The code is updated to ${to.slice(0, 7)}, but installing its dependencies failed (npm install, exit ${r.code}). Close the app, run \`npm ci\` in app/ and start it again. npm said:\n${r.out}`);
  return { from, to, dependencies: true };
}
