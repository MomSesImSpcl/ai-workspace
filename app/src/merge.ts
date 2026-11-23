// Merging an app-project branch into main through the workspace (selfdev-004, ADR 0017): the agent reports its
// checks and calls the workspace tool request_merge; the user approves one card; the app runs `gh pr merge` itself,
// outside any agent sandbox. Agents cannot merge on their own: the write guard blocks `gh pr merge`, and Codex's
// shells in a worktree get no gh login (`ghBlockArgs`).
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { agentText } from './registry.ts';
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
const mergedText = (pr: Pr, branch: string) => agentText('reply.merged-pr', { number: pr.number, branch, url: pr.url });

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
  if (!open && !args.title) throw new Error(agentText('reply.request_merge', { branch }, 'noTitle'));
  const what = open ? `pull request #${open.number} "${open.title}"` : `a new pull request "${args.title}"`;
  const allow = await ask(`Push branch ${branch} and squash-merge ${what} into main once the required checks pass. Checks the agent reports: ${args.checks}`.slice(0, 1000));
  if (allow === null) return agentText('reply.request_merge', {}, 'stopped');
  if (!allow) return agentText('reply.request_merge', {}, 'denied');
  const stale = check();
  if (stale) return agentText('reply.request_merge', { binding: stale }, 'stale');
  const mergedMeanwhile = mergedPr(branch, cwd);
  if (mergedMeanwhile) return agentText('reply.request_merge', { merged: mergedText(mergedMeanwhile, branch) }, 'mergedMeanwhile');
  // main's ruleset merges only branches that are up to date with main (ADR 0016), so main comes in first.
  const fetched = git(['fetch', 'origin', 'main'], cwd);
  if (!fetched.ok) return agentText('reply.request_merge', { output: fetched.out }, 'fetch');
  const updated = git(['merge', '--no-edit', 'origin/main'], cwd);
  if (!updated.ok) {
    git(['merge', '--abort'], cwd);
    return agentText('reply.request_merge', { branch, output: updated.out }, 'conflict');
  }
  const pushed = git(['push', '-u', 'origin', branch], cwd);
  if (!pushed.ok) return agentText('reply.request_merge', { branch, output: pushed.out }, 'push');
  let pr = open;
  if (!pr) {
    const created = gh(['pr', 'create', '--base', 'main', '--head', branch, '--title', args.title!, '--body', args.body ?? ''], cwd);
    if (!created.ok) return agentText('reply.request_merge', { output: created.out }, 'create');
    pr = branchPrs(branch, cwd)?.find((p) => p.state === 'OPEN');
    if (!pr) return agentText('reply.request_merge', {}, 'unreadable');
  }
  const auto = gh(['pr', 'merge', String(pr.number), '--squash', '--auto'], cwd);
  if (!auto.ok) return agentText('reply.request_merge', { number: pr.number, output: auto.out }, 'autoMerge');
  return agentText('reply.request_merge', { branch, number: pr.number, url: pr.url });
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
export const MERGE_NOTE = agentText('merge.note');
