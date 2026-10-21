// The read-only repository tool `read_repo` of the workspace MCP server (`app/src/approval-server.ts`, #31): commit
// history, commits, branches and status through git, pull requests, checks and issues through gh. For the orchestrator, which cannot
// run commands, and for Codex in a worktree, whose shells have no gh login (ADR 0017). It never writes or merges.
import { resolve } from 'node:path';
import { gh, run } from './restart.ts';

/** One question to `read_repo`; `action` picks it, the other fields are its options. */
export interface RepoQuery {
  action: 'log' | 'show' | 'branches' | 'status' | 'prs' | 'pr' | 'issues' | 'issue';
  ref?: string; // log: branch or commit to start from; show: the commit
  path?: string; // log: only commits that touch this path; status: a worktree of the project (default: its checkout)
  limit?: number; // log, prs, issues: how many (1–100, default 20)
  number?: number; // pr, issue
  state?: 'open' | 'closed' | 'merged' | 'all'; // prs, issues (default open)
  logs?: boolean; // pr: also the failed lines of its failed checks
}

const MAX = 30_000; // characters per answer, so one call cannot fill the agent's context
const cap = (text: string) => (text.length > MAX ? `${text.slice(0, MAX)}\n… (cut at ${MAX} characters)` : text);
// A ref git cannot mistake for an option: names, hashes, HEAD~2, main^, v1.0.
const SAFE_REF = /^[\w][\w./~^@{}-]*$/;

/** Runs a read-only git command; a failure is returned as the answer. */
async function git(root: string, args: string[]): Promise<string> {
  const r = await run('git', args, root);
  return r.code === 0 ? r.out : `git ${args[0]} failed: ${r.out}`;
}

/** Runs a read-only gh command and parses its JSON; throws with gh's message, so the agent sees why. */
async function ghJson<T>(root: string, args: string[]): Promise<T> {
  const r = await gh(args, root);
  if (r.code !== 0) throw new Error(`gh ${args.slice(0, 2).join(' ')} failed (is gh installed and logged in?): ${r.out}`);
  return JSON.parse(r.out) as T;
}

/** The checked-out worktrees of the repository at `root`: absolute path and branch (undefined when detached). */
async function worktrees(root: string): Promise<{ path: string; branch?: string }[]> {
  const r = await run('git', ['worktree', 'list', '--porcelain'], root);
  if (r.code !== 0) throw new Error(`git worktree failed: ${r.out}`);
  return r.out.split(/\r?\n\r?\n/).map((block) => ({
    path: /^worktree (.+)$/m.exec(block)?.[1] ?? '',
    branch: /^branch refs\/heads\/(.+)$/m.exec(block)?.[1],
  })).filter((w) => w.path);
}

const samePath = (a: string, b: string) => {
  const [x, y] = [resolve(a), resolve(b)];
  return process.platform === 'win32' || process.platform === 'darwin' ? x.toLowerCase() === y.toLowerCase() : x === y;
};

/** Every local and remote branch with its worktree and how far it is ahead of and behind `main`. */
async function branches(root: string): Promise<string> {
  const refs = await run('git', ['for-each-ref', '--format=%(refname) %(symref)', 'refs/heads', 'refs/remotes'], root);
  if (refs.code !== 0) return `git for-each-ref failed: ${refs.out}`;
  const trees = await worktrees(root);
  const base = (await run('git', ['rev-parse', '--verify', '-q', 'refs/heads/main'], root)).code === 0 ? 'refs/heads/main' : 'refs/remotes/origin/main';
  const lines: string[] = [];
  for (const row of refs.out.split(/\r?\n/)) {
    const [ref, symref] = row.split(' ');
    if (!ref || symref) continue; // origin/HEAD only points at another branch
    const remote = ref.startsWith('refs/remotes/');
    const name = ref.replace(/^refs\/(heads|remotes)\//, '');
    const counts = await run('git', ['rev-list', '--left-right', '--count', `${base}...${ref}`, '--'], root);
    const [behind, ahead] = counts.code === 0 ? counts.out.trim().split(/\s+/) : ['?', '?'];
    const tree = remote ? undefined : trees.find((w) => w.branch === name);
    lines.push(`${name}${remote ? ' (remote)' : ''}: ahead ${ahead}, behind ${behind}${tree ? `, worktree ${tree.path}` : ''}`);
  }
  return lines.join('\n') || 'No branches.';
}

/** `git status --short` of the project checkout, or of `path` when it is one of the repository's worktrees. */
async function status(root: string, path?: string): Promise<string> {
  let dir = root;
  if (path !== undefined) {
    const tree = (await worktrees(root)).find((w) => samePath(w.path, path));
    if (!tree) throw new Error(`Not a worktree of this project: ${path}`);
    dir = tree.path;
  }
  const out = await git(dir, ['status', '--short']);
  return out.trim() ? out : 'Clean: no changes.';
}

/** A check run of a pull request, as gh's `statusCheckRollup` lists it. */
interface Check { name?: string; context?: string; status?: string; conclusion?: string; state?: string; detailsUrl?: string; targetUrl?: string }

/**
 * Answers one `read_repo` question about the repository at `root` as text for the agent, at most 30,000 characters.
 * `log` lists commits (hash, date, author, subject); `show` one commit with its stat and diff; `branches` every local
 * and remote branch with its worktree and ahead/behind counts against `main`; `status` is `git status --short` of the
 * checkout or of a worktree given by `path` (it must belong to the project); `prs` and `issues`
 * list them; `pr` shows one with its checks and, with `logs`, the failed lines of each failed GitHub Actions job;
 * `issue` shows one with its comments. Only reads: refs are checked so git cannot take them as options.
 */
export async function readRepo(root: string, q: RepoQuery): Promise<string> {
  const limit = String(Math.min(100, Math.max(1, Math.trunc(q.limit ?? 20))));
  if (q.ref !== undefined && !SAFE_REF.test(q.ref)) throw new Error(`Not a branch or commit name: ${q.ref}`);
  const state = q.state ?? 'open';
  switch (q.action) {
    case 'log':
      return cap(await git(root, ['log', '--format=%h %ad %an: %s', '--date=short', '-n', limit, ...(q.ref ? [q.ref] : []), '--', ...(q.path ? [q.path] : [])]));
    case 'show':
      if (!q.ref) throw new Error('show needs ref: the commit to show');
      return cap(await git(root, ['show', '--stat', '--patch', '--format=fuller', q.ref, '--']));
    case 'branches':
      return cap(await branches(root));
    case 'status':
      return cap(await status(root, q.path));
    case 'prs': {
      const prs = await ghJson<{ number: number; title: string; state: string; headRefName: string; isDraft: boolean; updatedAt: string }[]>(root, ['pr', 'list', '--state', state, '--limit', limit, '--json', 'number,title,state,headRefName,isDraft,updatedAt']);
      return prs.map((p) => `#${p.number} ${p.state}${p.isDraft ? ' (draft)' : ''} ${p.headRefName} ${p.updatedAt.slice(0, 10)}: ${p.title}`).join('\n') || `No ${state} pull requests.`;
    }
    case 'pr': {
      if (!q.number) throw new Error('pr needs number');
      const p = await ghJson<{ number: number; title: string; state: string; url: string; headRefName: string; body: string; mergedAt?: string; statusCheckRollup?: Check[] }>(root, ['pr', 'view', String(q.number), '--json', 'number,title,state,url,headRefName,body,mergedAt,statusCheckRollup']);
      const checks = (p.statusCheckRollup ?? []).map((c) => `- ${c.name ?? c.context}: ${c.conclusion || c.state || c.status || 'pending'}`);
      let text = `#${p.number} ${p.state}${p.mergedAt ? ` (merged ${p.mergedAt.slice(0, 10)})` : ''} ${p.headRefName}: ${p.title}\n${p.url}\n\nChecks:\n${checks.join('\n') || '- none'}\n\n${p.body}`;
      if (q.logs) {
        for (const c of p.statusCheckRollup ?? []) {
          const job = /\/actions\/runs\/\d+\/job\/(\d+)/.exec(c.detailsUrl ?? '')?.[1];
          if (!job || !/FAILURE|TIMED_OUT|CANCELLED/.test(c.conclusion ?? '')) continue;
          const r = await gh(['run', 'view', '--job', job, '--log-failed'], root);
          text += `\n\nFailed lines of ${c.name}:\n${r.out.split(/\r?\n/).slice(-150).join('\n')}`;
        }
      }
      return cap(text);
    }
    case 'issues': {
      const list = await ghJson<{ number: number; title: string; state: string; labels: { name: string }[] }[]>(root, ['issue', 'list', '--state', state === 'merged' ? 'closed' : state, '--limit', limit, '--json', 'number,title,state,labels']);
      return list.map((i) => `#${i.number} ${i.state}${i.labels.length ? ` [${i.labels.map((l) => l.name).join(', ')}]` : ''}: ${i.title}`).join('\n') || `No ${state} issues.`;
    }
    case 'issue': {
      if (!q.number) throw new Error('issue needs number');
      const i = await ghJson<{ number: number; title: string; state: string; body: string; comments: { author?: { login: string }; body: string }[] }>(root, ['issue', 'view', String(q.number), '--json', 'number,title,state,body,comments']);
      return cap(`#${i.number} ${i.state}: ${i.title}\n\n${i.body}${i.comments.map((c) => `\n\n--- ${c.author?.login ?? 'comment'}:\n${c.body}`).join('')}`);
    }
  }
}
