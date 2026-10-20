// Merging an app-project branch into main through the workspace (selfdev-004, ADR 0017): the agent reports its
// checks and calls the workspace tool request_merge; the user approves one card; the app runs `gh pr merge` itself,
// outside any agent sandbox. Agents cannot merge on their own: the write guard blocks `gh pr merge`, and Codex's
// shells in a worktree get no gh login (`ghBlockArgs`).
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { home } from './store.ts';

/** What the agent passes to request_merge: its check results, and a title and body if the pull request is new. */
export interface MergeArgs { checks: string; title?: string; body?: string }

/** A pull request of the branch, as gh reports it. */
interface Pr { number: number; url: string; title: string; state: string }

/** Runs gh in `cwd`: `AI_WORKSPACE_GH` (a script runs with this Node; tests use a fake), else `gh`. */
function gh(args: string[], cwd: string): { ok: boolean; out: string } {
  const bin = process.env.AI_WORKSPACE_GH;
  const [cmd, pre] = bin ? (/\.(m?js|ts)$/.test(bin) ? [process.execPath, [bin]] : [bin, []]) : ['gh', []];
  const r = spawnSync(cmd, [...pre, ...args], { cwd, encoding: 'utf8', windowsHide: true, timeout: 120_000 });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? r.error.message : ''}`.trim() };
}

/** The open pull request of `branch`, created from `args` when there is none; throws with what the agent should do. */
function pullRequest(branch: string, cwd: string, args: MergeArgs): Pr {
  const view = () => gh(['pr', 'view', branch, '--json', 'number,url,title,state'], cwd);
  let r = view();
  let pr = r.ok ? (JSON.parse(r.out) as Pr) : undefined;
  if (pr?.state === 'MERGED') throw new Error(`Pull request #${pr.number} of branch ${branch} is already merged.`);
  if (pr?.state === 'OPEN') return pr;
  if (!args.title) throw new Error(`Branch ${branch} has no open pull request. Push the branch, then call request_merge again with a title (and a body) to open one.`);
  const created = gh(['pr', 'create', '--base', 'main', '--head', branch, '--title', args.title, '--body', args.body ?? ''], cwd);
  if (!created.ok) throw new Error(`Opening the pull request failed (push the branch first): ${created.out}`);
  r = view();
  pr = r.ok ? (JSON.parse(r.out) as Pr) : undefined;
  if (!pr) throw new Error(`The pull request was opened but cannot be read: ${r.out}`);
  return pr;
}

/**
 * Merges the worktree branch `branch` into main after the user's approval. `ask` shows the card and returns the
 * answer (null when the turn was stopped). Returns what the agent is told.
 */
export async function requestMerge(branch: string, cwd: string, args: MergeArgs, ask: (detail: string) => Promise<boolean | null>): Promise<string> {
  const pr = pullRequest(branch, cwd, args);
  const allow = await ask(`Squash-merge #${pr.number} "${pr.title}" (branch ${branch}) into main. Checks the agent reports: ${args.checks}`.slice(0, 1000));
  if (allow === null) return 'The user stopped the turn; nothing was merged.';
  if (!allow) return `The user did not approve merging #${pr.number}; nothing was merged. Ask the user what to change.`;
  const merged = gh(['pr', 'merge', String(pr.number), '--squash'], cwd);
  if (!merged.ok) return `Merging #${pr.number} failed: ${merged.out}\nIf required checks are still running or failing, wait for them or fix them, then call request_merge again.`;
  return `Merged #${pr.number} into main (${pr.url}). ${merged.out}`.trim();
}

/**
 * Codex settings that leave gh without a login in its shells (selfdev-004): an empty `GH_CONFIG_DIR`, so a Codex
 * session in a worktree cannot merge, or use gh at all, from its sandbox. Codex already drops variables named like
 * tokens (`GH_TOKEN`) from its shells. Only for worktree sessions; empty otherwise.
 */
export function ghBlockArgs(worktree: boolean): string[] {
  if (!worktree) return [];
  const dir = join(home(), 'gh-none');
  mkdirSync(dir, { recursive: true });
  return ['-c', `shell_environment_policy.set.GH_CONFIG_DIR=${JSON.stringify(dir)}`];
}

/** Whether a shell command merges a pull request with gh (`gh pr merge`, or the merge endpoint through `gh api`). */
export function mergeCommand(command: string): boolean {
  return /\bgh(\.exe)?["']?\s+pr\s+merge\b/i.test(command) || /\bgh(\.exe)?["']?\s+api\b[^;&|\n]*\/pulls\/\d+\/merge\b/i.test(command);
}

/** What agents in the app project are told (selfdev-003/004). */
export const MERGE_NOTE = 'This session works in its own git worktree and branch of the workspace\'s own repository. Before you ask to merge, run `npm run typecheck` and `npm test` in app/ (on Windows `npm.cmd`) and report both results in the chat. To merge into main, push the branch and call the workspace tool request_merge with those results (and a title and body if the branch has no pull request yet): it opens the pull request if needed, asks the user, and merges. Never run `gh pr merge` yourself; it is blocked.';
