# 2026-10-20: checkout changes reported; read_repo for every agent

Scope: [selfdev-002 and selfdev-004](../../features/self-development/SPEC.md#requirements), amendments to [ADR 0015](../../architecture/decisions/0015-write-guard.md) and [ADR 0017](../../architecture/decisions/0017-merge-through-workspace.md), [#18](https://github.com/MomSesImSpcl/ai-workspace/issues/18), [#31](https://github.com/MomSesImSpcl/ai-workspace/issues/31). User decisions (2026-10-20): detection is enough for #18 and the storage folder may stay uncovered; for #31 a rule is the accepted limit, and the read tool goes to the orchestrator, chats and tasks alike.

## Outcome

- `checkoutSnapshot` and `checkoutChanges` in `app/src/worktrees.ts`, used in `oneTurn` (`app/src/turn.ts`) for app-project sessions and tasks: changes to the checkout during the turn become a notice naming up to 10 files and how to undo them.
- `app/src/repo-read.ts` (`readRepo`) and the `read_repo` registration in `app/src/approval-server.ts`; `read_repo` in `ORCHESTRATOR_TOOLS` and in Claude Code tasks' allowed tools; the orchestrator note mentions it.
- `MERGE_NOTE` in `app/src/merge.ts`: no other way to merge; `read_repo` for reading.

## Checks

- `npm run typecheck` clean, `npm test` 86/86: the checkout notice (`app/test/worktrees.test.ts`), `readRepo` with git and a fake gh (`app/test/repo-read.test.ts`), the tool list per session kind (`app/test/tasks.test.ts`).
- A real MCP call of `read_repo` through `app/src/approval-server.ts` on this repository: `log` for a project session, the error naming the projects for a global session, and `log` with `project`.
- Not run with a real agent in the app.
