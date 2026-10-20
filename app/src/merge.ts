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

/** Runs a tool in `cwd`: the test seam `env` (a script runs with this Node) if set, else `bin`. */
function run(bin: string, env: string, args: string[], cwd: string): { ok: boolean; out: string } {
  const own = process.env[env];
  const [cmd, pre] = own ? (/\.(m?js|ts)$/.test(own) ? [process.execPath, [own]] : [own, []]) : [bin, []];
  const r = spawnSync(cmd, [...pre, ...args], { cwd, encoding: 'utf8', windowsHide: true, timeout: 120_000 });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? r.error.message : ''}`.trim() };
}
const gh = (args: string[], cwd: string) => run('gh', 'AI_WORKSPACE_GH', args, cwd);
const git = (args: string[], cwd: string) => run('git', 'AI_WORKSPACE_GIT', args, cwd);

/** The branch's pull request, if gh finds one. */
function findPr(branch: string, cwd: string): Pr | undefined {
  const r = gh(['pr', 'view', branch, '--json', 'number,url,title,state'], cwd);
  return r.ok ? (JSON.parse(r.out) as Pr) : undefined;
}

/**
 * Merges the worktree branch `branch` into main after the user's approval. `ask` shows the card and returns the
 * answer (null when the turn was stopped); nothing happens before it. On Allow the app, outside any agent sandbox
 * and with the user's credentials, merges main into the branch (the ruleset merges only up-to-date branches), pushes
 * it (Codex cannot from its Windows sandbox), opens the pull request
 * if there is none, and turns on auto-merge, so GitHub squash-merges once the required checks pass (ADR 0016).
 * Returns what the agent is told; throws when the request cannot go to the user.
 */
export async function requestMerge(branch: string, cwd: string, args: MergeArgs, ask: (detail: string) => Promise<boolean | null>): Promise<string> {
  const existing = findPr(branch, cwd);
  if (existing?.state === 'MERGED') throw new Error(`Pull request #${existing.number} of branch ${branch} is already merged.`);
  const open = existing?.state === 'OPEN' ? existing : undefined;
  if (!open && !args.title) throw new Error(`Branch ${branch} has no open pull request. Call request_merge again with a title (and a body) for it.`);
  const what = open ? `pull request #${open.number} "${open.title}"` : `a new pull request "${args.title}"`;
  const allow = await ask(`Push branch ${branch} and squash-merge ${what} into main once the required checks pass. Checks the agent reports: ${args.checks}`.slice(0, 1000));
  if (allow === null) return 'The user stopped the turn; nothing was pushed or merged.';
  if (!allow) return 'The user did not approve the merge; nothing was pushed or merged. Ask the user what to change.';
  // main's ruleset merges only branches that are up to date with main (ADR 0016), so main comes in first.
  const fetched = git(['fetch', 'origin', 'main'], cwd);
  if (!fetched.ok) return `Fetching main failed; nothing was pushed or merged: ${fetched.out}`;
  const updated = git(['merge', '--no-edit', 'origin/main'], cwd);
  if (!updated.ok) {
    git(['merge', '--abort'], cwd);
    return `Bringing ${branch} up to date with main failed (a merge conflict, most likely); nothing was pushed or merged. Merge origin/main into the branch yourself, resolve the conflicts, run the checks again, commit, and call request_merge again. Git said: ${updated.out}`;
  }
  const pushed = git(['push', '-u', 'origin', branch], cwd);
  if (!pushed.ok) return `Pushing branch ${branch} failed; nothing was merged: ${pushed.out}`;
  let pr = open;
  if (!pr) {
    const created = gh(['pr', 'create', '--base', 'main', '--head', branch, '--title', args.title!, '--body', args.body ?? ''], cwd);
    if (!created.ok) return `Opening the pull request failed; nothing was merged: ${created.out}`;
    pr = findPr(branch, cwd);
    if (!pr) return 'The pull request was opened but cannot be read; nothing was merged.';
  }
  const merged = gh(['pr', 'merge', String(pr.number), '--squash', '--auto'], cwd);
  if (!merged.ok) return `Turning on auto-merge for #${pr.number} failed: ${merged.out}`;
  return `Pushed ${branch}; auto-merge is on for #${pr.number} (${pr.url}): GitHub squash-merges it into main when the required checks pass. If a check fails, nothing is merged: fix it, commit, and call request_merge again.`;
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
export const MERGE_NOTE = 'This session works in its own git worktree and branch of the workspace\'s own repository. Before you ask to merge, run `npm run typecheck` and `npm test` in app/ (on Windows `npm.cmd`) and report both results in the chat. To merge into main, commit your work and call the workspace tool request_merge with those results (and a title and body if the branch has no pull request yet): after the user approves, it pushes the branch, opens the pull request if needed, and merges it once the required checks pass. You need not push yourself. Never run `gh pr merge` yourself; it is blocked.';
