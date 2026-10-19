// Claude Code PreToolUse hook for every session (selfdev-002, ADR 0015): denies file edits and shell commands
// that would change the running app's checkout or the workspace's storage outside the session's own folder.
// Usage (set by the adapter): node src/guard-hook.ts <session folder> <guarded folder>..., with the hook input on stdin.
import { text } from 'node:stream/consumers';
import { guardedCommand, guardedPath } from './worktrees.ts';

const [allow = '', ...deny] = process.argv.slice(2);
const input = JSON.parse(await text(process.stdin)) as { tool_name?: string; tool_input?: Record<string, unknown>; cwd?: string };
const args = input.tool_input ?? {};
const g = { allow, deny };
const cwd = input.cwd || allow;
const path = args.file_path ?? args.notebook_path;
const hit = typeof args.command === 'string' ? guardedCommand(g, args.command, cwd) : typeof path === 'string' ? guardedPath(g, path, cwd) : undefined;
if (hit) {
  const reason = `AI Workspace: writes to ${hit} are blocked, since the running app's checkout and the workspace's storage must stay untouched (selfdev-002). Work in ${allow}; to only read there, use the Read tool or a command that only reads (such as ls, cat, grep, git log or git diff, without writing output to a file).`;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
}
