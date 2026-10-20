// The app project's branches (worktrees): their state for Settings, removal, and the automatic cleanup of
// merged ones, so forgotten branches cannot pile up (selfdev-001, ADR 0014). Git work lives in worktrees.ts.
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { allSessions, saveSession, turnRunning, type Session } from './sessions.ts';
import { listProjects, type Project } from './store.ts';
import { deleteWorktree, isAppProject, listWorktrees, worktreeState, type Worktree } from './worktrees.ts';

/** One branch of the app project as Settings lists it. */
export interface BranchInfo extends Worktree {
  merged: boolean; // all its own commits are in main: the cleanup removes it once nothing runs in it
  ahead: number; // commits not in main
  dirty: boolean; // uncommitted changes in its folder
  busy: boolean; // a chat or task has an agent process running in it
  sessions: number; // chats working in it
  lastUsed?: string; // the latest activity of a chat or task in it (ISO time)
}

const samePath = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
/** Chats and tasks that work in a worktree folder. */
const usersOf = (path: string, all: Session[]) => all.filter((s) => s.worktree && samePath(s.worktree.path, path));

/** The app project, if the app runs from a checkout and it is registered. */
export const appProject = (): Project | undefined => listProjects().find(isAppProject);

/** Every branch of the app project with its state, newest activity first. */
export function branchInfo(project: Project): BranchInfo[] {
  const all = allSessions();
  return listWorktrees(project).map((wt) => {
    const users = usersOf(wt.path, all);
    const lastUsed = users.map((s) => s.updatedAt).sort().at(-1);
    return { ...wt, ...worktreeState(project.root, wt), busy: users.some((s) => turnRunning(s.id)), sessions: users.filter((s) => !s.task).length, lastUsed };
  }).sort((a, b) => (b.lastUsed ?? '').localeCompare(a.lastUsed ?? ''));
}

/** Bytes in a folder and everything below it; unreadable entries count as 0. Slow on large dependency folders, so only Settings asks. */
export async function folderSize(dir: string): Promise<number> {
  let total = 0;
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true }).catch(() => [])) {
    if (e.isFile()) total += (await stat(join(e.parentPath, e.name)).catch(() => ({ size: 0 }))).size;
  }
  return total;
}

/** Archives the chats of removed branches: they stay readable under "Show archived" but cannot continue. */
function archiveGone(all: Session[]): number {
  let n = 0;
  for (const s of all) if (!s.task && !s.archived && s.worktree?.ready && !existsSync(s.worktree.path)) { saveSession({ ...s, archived: true }); n++; }
  return n;
}

/**
 * Removes one branch of the app project with its folder, then archives its chats. Refused while an agent runs
 * in it. A branch that is not merged or has uncommitted changes needs `force`, since that work is lost.
 */
export function removeBranch(path: string, force = false): void {
  const project = appProject();
  const b = project && branchInfo(project).find((x) => samePath(x.path, path));
  if (!project || !b) throw new Error(`Not a branch of this app: ${path}`);
  if (b.busy) throw new Error(`An agent is running in ${b.branch}: stop its chat or task first.`);
  if (!force && (!b.merged || b.dirty)) throw new Error(`${b.branch} has ${[b.ahead && `${b.ahead} unmerged commit${b.ahead === 1 ? '' : 's'}`, b.dirty && 'uncommitted changes'].filter(Boolean).join(' and ') || 'no merged work'}; removing it loses that work.`);
  deleteWorktree(project.root, b, force);
  archiveGone(allSessions());
}

/**
 * The automatic cleanup, at app start (`ui` in `app/src/cli.ts`), which follows right after new merges arrive
 * through Update and restart (#24): removes merged branches, squash-merged ones included, without uncommitted changes and without a running agent, and archives the chats of any branch that is gone
 * (also one the agent removed itself). Unmerged work is never touched. Returns the removed branch names.
 */
export function cleanupBranches(): string[] {
  const project = appProject();
  if (!project) return [];
  const removed: string[] = [];
  for (const b of branchInfo(project)) {
    if (!b.merged || b.dirty || b.busy) continue;
    try { deleteWorktree(project.root, b); removed.push(b.branch); } catch { /* git refused: left for the user */ }
  }
  archiveGone(allSessions());
  return removed;
}
