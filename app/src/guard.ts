// The write guard's answer to a Claude Code PreToolUse hook (selfdev-002, ADR 0015), served over HTTP from the
// process that runs the agent, so no process starts per tool call. `guard-hook.ts` gives the same answer as a
// command hook, the fallback when the server cannot start.
import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { guardedCommand, guardedPath, guardNotice, type Guard } from './worktrees.ts';

/** What Claude Code sends a PreToolUse hook. */
export interface HookInput { tool_name?: string; tool_input?: Record<string, unknown>; cwd?: string }

/** The hook's answer: a deny with the reason, or `{}` to let the call through. */
export function guardDecision(g: Guard, input: HookInput): object {
  const args = input.tool_input ?? {};
  const cwd = input.cwd || g.allow;
  const path = args.file_path ?? args.notebook_path;
  const hit = typeof args.command === 'string' ? guardedCommand(g, args.command, cwd) : typeof path === 'string' ? guardedPath(g, path, cwd) : undefined;
  if (!hit) return {};
  // The first paragraph is shown in the chat as a notice; the rest tells the agent what to do instead.
  const notice = guardNotice(hit, typeof args.command === 'string' ? { command: args.command } : { file: String(path) });
  const reason = `${notice}\n\nThe running app's checkout and the workspace's storage must stay untouched. Work in ${g.allow}; to only read there, use the Read tool or a command that only reads (such as ls, cat, grep, git log or git diff, without writing output to a file).`;
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } };
}

const runs = new Map<string, Guard>(); // token -> the guard of one agent run
let server: Promise<string | undefined> | undefined;

/**
 * Starts this process's guard server once (127.0.0.1, a free port) and returns its URL, or `undefined` when it
 * cannot listen. Each run is told apart by its token, which is also the only way in. The server does not keep
 * the process alive.
 */
export function guardServer(): Promise<string | undefined> {
  return server ??= new Promise((done) => {
    const s: Server = createServer((req, res) => {
      const g = runs.get(String(req.headers['x-aiws-token'] ?? ''));
      if (req.method !== 'POST' || req.url !== '/guard' || !g) { res.writeHead(403).end(); return; }
      let body = '';
      req.on('data', (d) => (body += d)).on('end', () => {
        let answer: object;
        try { answer = guardDecision(g, JSON.parse(body) as HookInput); } catch { answer = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'AI Workspace: the write guard could not read this call.' } }; }
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(answer));
      });
    });
    s.on('error', () => done(undefined));
    s.listen(0, '127.0.0.1', () => {
      s.unref();
      const a = s.address();
      done(a && typeof a === 'object' ? `http://127.0.0.1:${a.port}/guard` : undefined);
    });
  });
}

/** Registers one run's guard and returns its token; `forget` it when the run ends. */
export function guardToken(g: Guard): string {
  const token = randomBytes(24).toString('hex');
  runs.set(token, g);
  return token;
}

export const forget = (token: string | undefined) => { if (token) runs.delete(token); };
