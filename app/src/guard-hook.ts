// Claude Code PreToolUse command hook (selfdev-002, ADR 0015): the write guard's fallback when the adapter's
// HTTP guard server (`guard.ts`) cannot start. Same answer, but one process per tool call (about 105 ms).
// Usage (set by the adapter): node src/guard-hook.ts [--merge] <session folder> <guarded folder>..., with the hook input on stdin.
import { text } from 'node:stream/consumers';
import { guardDecision, type HookInput } from './guard.ts';

// `--merge` first: also block `gh pr merge` (selfdev-004).
const argv = process.argv.slice(2);
const merge = argv[0] === '--merge';
const [allow = '', ...deny] = merge ? argv.slice(1) : argv;
const answer = guardDecision({ allow, deny, merge }, JSON.parse(await text(process.stdin)) as HookInput);
if ('hookSpecificOutput' in answer) process.stdout.write(JSON.stringify(answer));
