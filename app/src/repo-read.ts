// The read-only repository tool `read_repo` of the workspace MCP server (`app/src/approval-server.ts`, #31): commit
// history and commits through git, pull requests, checks and issues through gh. For the orchestrator, which cannot
// run commands, and for Codex in a worktree, whose shells have no gh login (ADR 0017). It never writes or merges.
import { gh, run } from './restart.ts';

/** One question to `read_repo`; `action` picks it, the other fields are its options. */
export interface RepoQuery {
  action: 'log' | 'show' | 'prs' | 'pr' | 'issues' | 'issue';
  ref?: string; // log: branch or commit to start from; show: the commit
  path?: string; // log: only commits that touch this path
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

/** A check run of a pull request, as gh's `statusCheckRollup` lists it. */
interface Check { name?: string; context?: string; status?: string; conclusion?: string; state?: string; detailsUrl?: string; targetUrl?: string }

/**
 * Answers one `read_repo` question about the repository at `root` as text for the agent, at most 30,000 characters.
 * `log` lists commits (hash, date, author, subject); `show` one commit with its stat and diff; `prs` and `issues`
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
