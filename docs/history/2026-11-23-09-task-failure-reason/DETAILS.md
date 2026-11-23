# 2026-11-23: a failed task says why it failed

**Why (user):** a real task failed with "Failed to authenticate: OAuth session expired and could not be refreshed", but the chat card and the task page showed only "Failed before the first step"; failures must not be swallowed.

**Outcome:** `app/src/ui.ts`: a task's `reason` joins the turn's marker and its error; each run in the task details carries `error`. `app/src/ui.html`: the run's Status line shows it. `app/src/approval-server.ts`: task_status returns `error` next to `stoppedAt`, so the orchestrator can report it. Plain chats already showed the error.

**Checks:** `npm run typecheck` clean; `npm test` 123/123 on Windows; new test in `app/test/tasks.test.ts` (a failed task's card and details carry the error).

**Branch:** `agent-instructions` (this worktree), committed locally, not pushed.
