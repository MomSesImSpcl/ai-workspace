// Merging an app-project branch into main through the workspace (selfdev-004, ADR 0017): the agent calls the workspace
// tool request_merge; the app runs typecheck and tests in the worktree, the user approves one card, and the app runs `gh pr merge` itself,
// outside any agent sandbox. Agents cannot merge on their own: the write guard blocks `gh pr merge`, and Codex's
// shells in a worktree get no gh login (`ghBlockArgs`).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AgentError, agentText, type AgentText } from './registry.ts';
import { home } from './store.ts';
import { npmCommand } from './worktrees.ts';

/** What the agent passes to request_merge: a title and body if the pull request is new. */
export interface MergeArgs { title?: string; body?: string }

/** The checks request_merge runs before the card (selfdev-003): `npm run <script>` in the worktree's app folder. */
const CHECKS = [['typecheck', ['run', 'typecheck']], ['npm test', ['test']]] as const;

/** Runs the checks in `cwd` one after another; the first failure stops them. `summary` is what the card shows. */
export async function runChecks(cwd: string): Promise<{ ok: true; summary: string } | { ok: false; check: string; output: string }> {
  const dir = existsSync(join(cwd, 'app', 'package.json')) ? join(cwd, 'app') : cwd;
  const done: string[] = [];
  for (const [name, args] of CHECKS) {
    const [cmd, argv, shell] = npmCommand([...args]);
    const { code, output } = await new Promise<{ code: number | null; output: string }>((end) => {
      let output = '';
      const child = spawn(cmd, argv, { cwd: dir, shell, windowsHide: true });
      child.stdout.on('data', (d) => (output += d));
      child.stderr.on('data', (d) => (output += d));
      child.on('error', (e) => end({ code: -1, output: e.message }));
      child.on('close', (c) => end({ code: c, output }));
    });
    const lines = output.trim().split(/\r?\n/);
    if (code !== 0) return { ok: false, check: name, output: lines.slice(-30).join('\n') };
    // node --test ends with counts ("ℹ pass 123"); other runners show their last line.
    const counts = lines.filter((l) => /^\S*\s*(tests|pass|fail) \d+$/.test(l.trim())).map((l) => l.replace(/^\S*\s*/, '').trim());
    done.push(`${name}: ${counts.length ? counts.join(', ') : 'passed'}`);
  }
  return { ok: true, summary: done.join('; ') };
}

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
const mergedText = (pr: Pr, branch: string) => agentText('tool.request_merge', { number: pr.number, branch, url: pr.url }, 'alreadyMerged');

/**
 * Merges the worktree branch `branch` into main after the user's approval. Before the card it refuses uncommitted work and runs
 * typecheck and tests in the worktree (`verify`, selfdev-003); a failure goes back to the agent with the output. `ask` shows the card and returns the
 * answer (null when the turn was stopped); nothing happens before it. On Allow the app, outside any agent sandbox
 * and with the user's credentials, merges main into the branch (the ruleset merges only up-to-date branches), pushes
 * it (Codex cannot from its Windows sandbox), opens the pull request
 * if there is none, and turns on auto-merge, so GitHub squash-merges once the required checks pass (ADR 0016).
 * `check` validates the session's binding (`bindingProblem` in app/src/binding.ts: the worktree in `cwd` still has
 * `branch` checked out, and belongs to the project): before the card, and again after Allow, right before git
 * merges into the checked-out branch, since the card may wait a long time (#62). A merged pull request is refused at
 * both points too. Returns what the agent is told; throws when the request cannot go to the user.
 */
export async function requestMerge(branch: string, cwd: string, args: MergeArgs, ask: (detail: string) => Promise<boolean | null>, check: () => AgentText | undefined = () => undefined, verify = runChecks, status: (text: string, closed?: boolean) => void = () => {}): Promise<AgentText> {
  const problem = check();
  if (problem) throw new AgentError(problem);
  const prs = branchPrs(branch, cwd) ?? [];
  const merged = mergedPr(branch, cwd, prs);
  if (merged) throw new AgentError(mergedText(merged, branch));
  const open = prs.find((p) => p.state === 'OPEN');
  if (!open && !args.title) throw new AgentError(agentText('tool.request_merge', { branch }, 'noTitle'));
  // The workspace checks what it would publish (agent-interface-008): committed work only, typecheck and tests passing.
  const dirty = git(['status', '--porcelain'], cwd).out.split('\n').filter(Boolean);
  if (dirty.length) return agentText('tool.request_merge', { files: dirty.slice(0, 10).map((l) => l.trim().replace(/^\S+\s+/, '')).join(', ') + (dirty.length > 10 ? ` and ${dirty.length - 10} more` : '') }, 'uncommitted');
  // The card goes up at once and the checks run alongside it, so the user reads it while they run; Allow takes
  // effect only once they pass, and a failure withdraws the card.
  const checking = verify(cwd);
  const what = open ? `pull request #${open.number} "${open.title}"` : `a new pull request "${args.title}"`;
  const answer = ask(`Push branch ${branch} and squash-merge ${what} into main once typecheck and tests pass in the worktree and the required checks pass on GitHub.`.slice(0, 1000));
  status('Typecheck and tests are running in the worktree…');
  const failed = (c: { check: string; output: string }) => agentText('tool.request_merge', { check: c.check, output: c.output }, 'checksFailed');
  const first = await Promise.race([checking.then((c) => ({ c })), answer.then((a) => ({ a }))]);
  let allow: boolean | null;
  if ('c' in first) {
    if (!first.c.ok) { status(`${first.c.check} failed in the worktree; nothing will be merged.`, true); return failed(first.c); }
    status(`Checks passed in the worktree: ${first.c.summary}`);
    allow = await answer;
  } else {
    // shortcut: after Deny or a stop the checks still run to their end; stop them if they get long.
    allow = first.a;
    if (allow) {
      status('Allowed: merging once typecheck and tests pass in the worktree…');
      const c = await checking;
      if (!c.ok) { status(`${c.check} failed in the worktree; nothing was merged.`); return failed(c); }
      status(`Checks passed in the worktree: ${c.summary}`);
    }
  }
  if (allow === null) return agentText('tool.request_merge', {}, 'stopped');
  if (!allow) return agentText('tool.request_merge', {}, 'denied');
  const stale = check();
  if (stale) return agentText('tool.request_merge', { binding: stale }, 'stale');
  const mergedMeanwhile = mergedPr(branch, cwd);
  if (mergedMeanwhile) return agentText('tool.request_merge', { merged: mergedText(mergedMeanwhile, branch) }, 'mergedMeanwhile');
  // main's ruleset merges only branches that are up to date with main (ADR 0016), so main comes in first.
  const fetched = git(['fetch', 'origin', 'main'], cwd);
  if (!fetched.ok) return agentText('tool.request_merge', { output: fetched.out }, 'fetch');
  const updated = git(['merge', '--no-edit', 'origin/main'], cwd);
  if (!updated.ok) {
    git(['merge', '--abort'], cwd);
    return agentText('tool.request_merge', { branch, output: updated.out }, 'conflict');
  }
  const pushed = git(['push', '-u', 'origin', branch], cwd);
  if (!pushed.ok) return agentText('tool.request_merge', { branch, output: pushed.out }, 'push');
  let pr = open;
  if (!pr) {
    const created = gh(['pr', 'create', '--base', 'main', '--head', branch, '--title', args.title!, '--body', args.body ?? ''], cwd);
    if (!created.ok) return agentText('tool.request_merge', { output: created.out }, 'create');
    pr = branchPrs(branch, cwd)?.find((p) => p.state === 'OPEN');
    if (!pr) return agentText('tool.request_merge', {}, 'unreadable');
  }
  const auto = gh(['pr', 'merge', String(pr.number), '--squash', '--auto'], cwd);
  if (!auto.ok) return agentText('tool.request_merge', { number: pr.number, output: auto.out }, 'autoMerge');
  return agentText('tool.request_merge', { branch, number: pr.number, url: pr.url }, 'ok');
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

/**
 * The environment of an agent in a worktree session without GitHub or git credentials (selfdev-004): no gh login or
 * token, no git credential helper and no password prompt, so it cannot push, open or merge pull requests itself and
 * request_merge, which the app runs with the user's credentials, is the only way to publish. shortcut: a remote reached
 * over SSH keeps the user's keys; block those too if a project publishes that way.
 */
export function noPublishEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = Object.fromEntries(Object.entries(env).filter(([k]) => !/^(GH_TOKEN|GITHUB_TOKEN|GH_ENTERPRISE_TOKEN|GITHUB_ENTERPRISE_TOKEN)$/.test(k)));
  const dir = join(home(), 'gh-none');
  mkdirSync(dir, { recursive: true });
  // An empty credential.helper resets git's helper list, so no stored credential is used.
  return { ...out, GH_CONFIG_DIR: dir, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'credential.helper', GIT_CONFIG_VALUE_0: '', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };
}

/** Whether a shell command merges a pull request with gh (`gh pr merge`, or the merge endpoint through `gh api`). */
export function mergeCommand(command: string): boolean {
  return /\bgh(\.exe)?["']?\s+pr\s+merge\b/i.test(command) || /\bgh(\.exe)?["']?\s+api\b[^;&|\n]*\/pulls\/\d+\/merge\b/i.test(command);
}

