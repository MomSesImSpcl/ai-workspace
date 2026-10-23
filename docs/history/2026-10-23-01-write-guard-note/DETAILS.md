# 2026-10-23: write-guard rules in the worktree note

**Scope:** [selfdev-002](../../features/self-development/SPEC.md#requirements), [ADR 0015](../../architecture/decisions/0015-write-guard.md). User request after two blocks in one chat: a non-reading command run while the agent's shell sat in the app's checkout (the `atCwd` rule of `guardedCommand`), and a heredoc whose issue text quoted the merge command (`mergeCommand` matches anywhere in the command, by design).

**Outcome:** `MERGE_NOTE` in `app/src/merge.ts`, given to worktree sessions of both agents, gains one sentence on the guard's rules. The guard is not loosened; it stays the limit, since agents may ignore instructions.

**Checks:** `npm run typecheck` and `npm test` in `app/`, private-data scan; results in the pull request. Not yet verified in the app that the block notices become rarer.

**Branch:** `claude/write-guard-note`.
