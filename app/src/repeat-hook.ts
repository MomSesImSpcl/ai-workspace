// Claude Code PreToolUse hook for tasks (runtime-004): a tool call that the interrupted attempt already
// completed is turned into an "ask", so it reaches the workspace as an approval card before it runs.
// Usage (set by the adapter): node src/repeat-hook.ts <sessionId>, with the hook input on stdin.
import { text } from 'node:stream/consumers';
import { fingerprint, readEvents, repeatsFor, turns } from './sessions.ts';

const [sessionId = ''] = process.argv.slice(2);
const input = JSON.parse(await text(process.stdin)) as { tool_name?: string; tool_input?: unknown };
const step = repeatsFor(turns(readEvents(sessionId), true)).get(fingerprint(input.tool_name ?? '', input.tool_input ?? {}));
if (step) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `Possible repeat: ${step} already ran before the interruption` } }));
}
