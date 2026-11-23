# 2026-11-23: request_merge runs the checks itself

**Scope:** merge batch of [agent-interface-008](../../features/agent-interface/SPEC.md#requirements) (user). Amends selfdev-003 and [ADR 0017](../../architecture/decisions/0017-merge-through-workspace.md). Effort: high.

**Outcome:**
- `app/src/merge.ts`: `runChecks(cwd)` runs `npm run typecheck`, then `npm test`, in the worktree's `app/` (through `npmCommand`, so Windows and the test seam work), stopping at the first failure; a summary from node's counts goes on the card. `requestMerge` refuses a worktree with uncommitted changes (`git status --porcelain`), then runs the checks before the card; failures return the `uncommitted` or `checksFailed` reply with the files or the last 30 lines of output. `MergeArgs` has no `checks`; `requestMerge` takes `verify` for tests.
- `app/src/approval-server.ts`: request_merge has no `checks` parameter.
- `app/src/registry.ts`: the merge note keeps the worktree and shell rules and says request_merge runs the checks and merges after approval; the sentences on running checks, reporting them, `gh pr merge`, the API, pushing and read_repo are gone. request_merge's description says it runs the checks and refuses uncommitted work. The guard's merge refusal points to request_merge only. Three proposals are removed.

**Checks:** `npm run typecheck` clean; `npm test` 124/124 on Windows. Tests use a fake npm (`app/test/fake-npm.mjs`); new test in `app/test/merge.test.ts`: uncommitted work and a failing typecheck or test return their reply with no card and nothing pushed. Real run of `runChecks` on this worktree: "typecheck: passed; npm test: tests 124, pass 124, fail 0" in 35 s. Found on the way: the status line's first letter was lost by `run`'s trim; parsing now drops the status column by pattern.

**Not verified:** a real request_merge from an agent in a test instance (the card text and the wait while tests run).

**Branch:** `agent-instructions` (this worktree), committed locally, not pushed.
