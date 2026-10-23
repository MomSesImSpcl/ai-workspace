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

/** A pull request of the branch, as gh reports it; `headRefOid` is the commit it was last updated with. */
interface Pr { number: number; url: string; title: string; state: string; headRefOid?: string }

/** Runs a tool in `cwd`: the test seam `env` (a script runs with this Node) if set, else `bin`. */
function run(bin: string, env: string, args: string[], cwd: string): { ok: boolean; out: string } {
  const own = process.env[env];
  const [cmd, pre] = own ? (/\.(m?js|ts)$/.test(own) ? [process.execPath, [own]] : [own, []]) : [bin, []];
  const r = spawnSync(cmd, [...pre, ...args], { cwd, encoding: 'utf8', windowsHide: true, timeout: 120_000 });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? r.error.message : ''}`.trim() };
}
const gh = (args: string[], cwd: string) => run('gh', 'AI_WORKSPACE_GH', args, cwd);
const git = (args: string[], cwd: string) => run('git', 'AI_WORKSPACE_GIT', args, cwd);

/** The branch's pull requests in every state (open, closed, merged), or undefined when gh cannot tell (not installed, offline, no GitHub remote). */
function branchPrs(branch: string, cwd: string): Pr[] | undefined {
  const r = gh(['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,url,title,state,headRefOid'], cwd);
  try { return r.ok ? (JSON.parse(r.out) as Pr[]) : undefined; } catch { return undefined; }
}

/**
 * The merged pull request that published this branch's work, if any (#62): merged, and its head commit is in the
 * local branch's history, so the branch already went into main and more work on it cannot be published again.
 * A merged pull request of an earlier branch with the same name (one made again from main, as a restored chat's,
 * ADR 0014) does not count: its head is not in this branch. `prs` defaults to gh's list; undefined when gh cannot tell.
 * Used before work (`bindingProblem` in app/src/binding.ts) and by `requestMerge`.
 */
export function mergedPr(branch: string, cwd: string, prs = branchPrs(branch, cwd)): Pr | undefined {
  return prs?.find((p) => p.state === 'MERGED' && /^[0-9a-f]{40}$/.test(p.headRefOid ?? '') && git(['merge-base', '--is-ancestor', p.headRefOid!, `refs/heads/${branch}`], cwd).ok);
}

/** What the agent is told when its branch's pull request is already merged: why, and the supported way on (#62). */
const mergedText = (pr: Pr, branch: string) => `Pull request #${pr.number} of branch ${branch} is already merged (${pr.url}), and this branch contains its commits, so nothing more can be published from it. Do not switch this worktree to another branch to publish: request_merge publishes only this session's branch. Tell the user to continue the conversation in a new chat ("Continue in a new chat" in the workspace), on a new branch from origin/main or on an existing branch they pick.`;

/**
 * Merges the worktree branch `branch` into main after the user's approval. `ask` shows the card and returns the
 * answer (null when the turn was stopped); nothing happens before it. On Allow the app, outside any agent sandbox
 * and with the user's credentials, merges main into the branch (the ruleset merges only up-to-date branches), pushes
 * it (Codex cannot from its Windows sandbox), opens the pull request
 * if there is none, and turns on auto-merge, so GitHub squash-merges once the required checks pass (ADR 0016).
 * `check` validates the session's binding (`bindingProblem` in app/src/binding.ts: the worktree in `cwd` still has
 * `branch` checked out, and belongs to the project): before the card, and again after Allow, right before git
 * merges into the checked-out branch, since the card may wait a long time (#62). A merged pull request is refused at
 * both points too. Returns what the agent is told; throws when the request cannot go to the user.
 */
export async function requestMerge(branch: string, cwd: string, args: MergeArgs, ask: (detail: string) => Promise<boolean | null>, check: () => string | undefined = () => undefined): Promise<string> {
  const problem = check();
  if (problem) throw new Error(problem);
  const prs = branchPrs(branch, cwd) ?? [];
  const merged = mergedPr(branch, cwd, prs);
  if (merged) throw new Error(mergedText(merged, branch));
  const open = prs.find((p) => p.state === 'OPEN');
  if (!open && !args.title) throw new Error(`Branch ${branch} has no open pull request. Call request_merge again with a title (and a body) for it.`);
  const what = open ? `pull request #${open.number} "${open.title}"` : `a new pull request "${args.title}"`;
  const allow = await ask(`Push branch ${branch} and squash-merge ${what} into main once the required checks pass. Checks the agent reports: ${args.checks}`.slice(0, 1000));
  if (allow === null) return 'The user stopped the turn; nothing was pushed or merged.';
  if (!allow) return 'The user did not approve the merge; nothing was pushed or merged. Ask the user what to change.';
  const stale = check();
  if (stale) return `Nothing was pushed or merged: the binding changed while the card waited. ${stale}`;
  const mergedMeanwhile = mergedPr(branch, cwd);
  if (mergedMeanwhile) return `Nothing was pushed or merged. ${mergedText(mergedMeanwhile, branch)}`;
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
    pr = branchPrs(branch, cwd)?.find((p) => p.state === 'OPEN');
    if (!pr) return 'The pull request was opened but cannot be read; nothing was merged.';
  }
  const auto = gh(['pr', 'merge', String(pr.number), '--squash', '--auto'], cwd);
  if (!auto.ok) return `Turning on auto-merge for #${pr.number} failed: ${auto.out}`;
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
export const MERGE_NOTE = 'This session works in its own git worktree and branch of the workspace\'s own repository. Writes outside this worktree are blocked: keep your shell in this folder (elsewhere only read, e.g. ls, cat, grep, git log), write file contents with your edit tools rather than shell heredocs or scripts, and keep merge commands out of shell command text, even as quoted data. Before you ask to merge, run `npm run typecheck` and `npm test` in app/ (on Windows `npm.cmd`) and report both results in the chat. To merge into main, commit your work and call the workspace tool request_merge with those results (and a title and body if the branch has no pull request yet): after the user approves, it pushes the branch, opens the pull request if needed, and merges it once the required checks pass. You need not push yourself. Never merge into main in any other way: not with `gh pr merge` (blocked), the GitHub API, curl or a push to main. Merging always needs the user\'s approval through request_merge. Keep this worktree on its branch: request_merge publishes only this session\'s branch, and the workspace runs and publishes nothing here while the worktree has another branch checked out or the branch\'s pull request is merged; then the user continues the conversation in a new chat. To read pull requests, checks or issues, use the workspace tool read_repo.';
