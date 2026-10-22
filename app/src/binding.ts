// Chat/worktree binding checks (#62, selfdev-001/004, ADR 0019): a session's stored worktree and branch are checked
// against git before the workspace runs work in them (`workRoot` in app/src/turn.ts) or publishes them (`request_merge`
// in app/src/approval-server.ts), and a chat whose binding went stale continues, after the user confirms, in a new chat
// with a new binding (`continueSession`). Nothing here switches, resets, deletes or moves work.
import { copyFileSync, existsSync } from 'node:fs';
import { mergedPr } from './merge.ts';
import { createSession, emit, loadSession, readEvents, saveSession, sessionFile, sessionWorking, turns, type Session } from './sessions.ts';
import { audit, getProject } from './store.ts';
import { branchExists, checkedOut, git, isAppProject, ownWorktreePath, planWorktree, type WorktreeChoice } from './worktrees.ts';

/** A turn refused because its session's binding does not match git; the chat then offers "Continue in a new chat". */
export class BindingError extends Error {}

/** Whether git's answer is a success: a lookup that may fail (a missing ref, an unset config key). */
const has = (cwd: string, args: string[]) => { try { git(cwd, args); return true; } catch { return false; } };

/**
 * Whether the branch was ever pushed: it has an upstream or a remote-tracking ref. Only such a branch can have a pull
 * request of its own, so only then is GitHub asked whether it merged (one gh call per turn instead of one per turn of
 * every chat). shortcut: a branch pushed without -u from another clone is not seen; upgrade if branches get published
 * other than through request_merge or the agent's own push.
 */
const published = (root: string, branch: string) => has(root, ['config', '--get', `branch.${branch}.remote`]) || has(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`]);

/** The work a stale worktree keeps, for the explanation: uncommitted files and commits on no remote branch. */
function keptWork(path: string): string {
  try {
    const files = git(path, ['status', '--porcelain']).split('\n').filter(Boolean).length;
    const commits = Number(git(path, ['rev-list', '--count', 'HEAD', '--not', '--remotes']));
    return `Its worktree keeps ${files} uncommitted file${files === 1 ? '' : 's'} and ${commits} commit${commits === 1 ? '' : 's'} on no remote branch, untouched.`;
  } catch { return 'Its worktree could not be read; nothing in it was touched.'; }
}

/**
 * Why a session's stored worktree binding cannot be trusted any more, or undefined when it still holds (#62). Checked
 * in this order: the project is still the app project (the only one with worktrees, ADR 0014); the folder is one the
 * workspace keeps for it; a made worktree still exists; git lists the folder as a worktree of the project's repository;
 * it still has the stored branch checked out (not another branch, not a detached HEAD); and, for a branch that was
 * pushed, its pull request is not merged with this branch's commits (`mergedPr`; skipped with `merged: false`, since
 * `requestMerge` asks gh itself). A planned worktree not made yet passes. The answer names the session, project,
 * folder, stored and actual branch and the work the folder keeps, and says how to go on. Git HEAD is never trusted in
 * place of the stored branch, and nothing is changed.
 */
export function bindingProblem(s: Pick<Session, 'id' | 'projectId' | 'worktree' | 'task'>, opts: { merged?: boolean } = {}): string | undefined {
  const wt = s.worktree;
  if (!wt) return undefined;
  const who = `${s.task ? 'Task' : 'Chat'} ${s.id} of project ${s.projectId} is bound to branch ${wt.branch} in ${wt.path}.`;
  const next = s.task ? 'The workspace runs no agent and publishes nothing for it until the binding matches; continue the work from its chat.'
    : 'The workspace runs no agent and publishes nothing for this chat until the binding matches; it switched, reset and deleted nothing. To keep working, continue this conversation in a new chat ("Continue in a new chat" below), on a new branch from freshly fetched origin/main or on an existing branch you pick.';
  const say = (reason: string) => `${reason} ${who} ${existsSync(wt.path) ? keptWork(wt.path) : ''} ${next}`.replace(/ {2,}/g, ' ');
  let project;
  try { project = getProject(s.projectId); } catch { return say(`Project ${s.projectId} is no longer in the workspace.`); }
  if (!isAppProject(project)) return say(`Project ${s.projectId} is not the app project, the only one whose sessions work in worktrees.`);
  if (!ownWorktreePath(project, wt.path)) return say(`The folder ${wt.path} is not a worktree the workspace keeps for project ${s.projectId}.`);
  if (!existsSync(wt.path)) return wt.ready ? say(`This session's worktree is gone (${wt.path}, branch ${wt.branch}).`) : undefined;
  const actual = checkedOut(project.root, wt.path);
  if (!actual) return say(`The folder ${wt.path} is not a worktree of the repository ${project.root}.`);
  if (actual.branch !== wt.branch) {
    const now = actual.branch ? `branch ${actual.branch}` : 'a detached HEAD';
    return say(`The worktree has ${now} checked out (HEAD ${actual.head.slice(0, 7)}), not the bound branch ${wt.branch}.${branchExists(project.root, wt.branch) ? '' : ` Branch ${wt.branch} no longer exists.`}`);
  }
  if (opts.merged !== false && published(project.root, wt.branch)) {
    const pr = mergedPr(wt.branch, wt.path);
    if (pr) return say(`Pull request #${pr.number} (${pr.url}) of branch ${wt.branch} is already merged, and the branch contains its commits: its work is published.`);
  }
  return undefined;
}

/**
 * Continues chat `id` in a new chat with a new binding, after the user confirmed it in the chat (#62, ADR 0019): a
 * new branch (`choice.name`) made at its first message from freshly fetched origin/main, or an existing workspace
 * worktree (`choice.path`, checked like any binding first, so a merged or foreign one is refused). The new chat
 * keeps the old one's role, agent, model, effort and task settings and gets a copy of its conversation, which the
 * agent receives with the next message (`transcript` in app/src/sessions.ts); both chats get a notice. The old chat
 * keeps its binding and log, its worktree is not touched, and uncommitted work is not moved. Refused for tasks,
 * for chats without a worktree, and while the chat is working, so an active session is never cut off.
 */
export function continueSession(id: string, choice: WorktreeChoice): Session {
  const old = loadSession(id);
  if (old.task) throw new Error('A task continues from its chat, not on its own.');
  if (!old.worktree) throw new Error('Only chats that work in a worktree of the app project continue this way.');
  if (sessionWorking(id)) throw new Error('This chat is working: wait for its turn to end, or stop it, before continuing it in a new chat.');
  if (!choice.name && !choice.path) throw new Error('Pick a new branch name or an existing branch for the new chat.');
  const planned = planWorktree(getProject(old.projectId), id, choice)!; // refuses invalid or taken names and foreign folders
  if (choice.path) {
    const problem = bindingProblem({ id, projectId: old.projectId, worktree: planned });
    if (problem) throw new Error(`Branch ${planned.branch} cannot take this conversation either. ${problem}`);
  }
  const s = createSession(old.projectId, old.role, { integration: old.integration, model: old.model }, choice);
  if (choice.name) s.worktree!.base = 'origin/main';
  const n = turns(readEvents(id), false).at(-1)?.n ?? 0;
  Object.assign(s, { title: old.title, effort: old.effort, permissionMode: old.permissionMode, taskCap: old.taskCap, taskMode: old.taskMode, continuedFrom: { id, turn: n } });
  saveSession(s);
  if (existsSync(sessionFile(id, '.jsonl'))) copyFileSync(sessionFile(id, '.jsonl'), sessionFile(s.id, '.jsonl'));
  const where = choice.name ? `a new branch ${s.worktree!.branch} from freshly fetched origin/main, made with the next message` : `the existing branch ${s.worktree!.branch} in ${s.worktree!.path}`;
  emit(s.id, n, { type: 'notice', text: `Continued from chat ${id}, which stays bound to branch ${old.worktree.branch}. This chat works on ${where}; the agent gets the conversation so far with the next message. Nothing was moved from the old worktree.` });
  emit(id, n, { type: 'notice', text: `This conversation continues in chat ${s.id} on branch ${s.worktree!.branch}. This chat keeps its binding to branch ${old.worktree.branch} in ${old.worktree.path}; nothing there was changed.` });
  audit({ kind: 'session', sessionId: s.id, event: 'continued', from: id, fromBranch: old.worktree.branch, branch: s.worktree!.branch });
  return loadSession(s.id);
}
