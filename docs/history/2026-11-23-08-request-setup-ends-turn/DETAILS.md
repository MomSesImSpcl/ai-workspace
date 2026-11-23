# 2026-11-23: the workspace ends a task's turn after request_setup

**Scope:** first conversion batch of [agent-interface-008](../../features/agent-interface/SPEC.md#requirements) (user picked it). Effort: high.

**Outcome:**
- `app/src/turn.ts` (`oneTurn`): while a task's turn runs, the host's 300 ms watch sees items added by request_setup (`task.setupAdded`) and, once every step of the turn has finished (the tool call has returned), interrupts the turn like Pause does, keeping the process. The turn is recorded as done, not stopped; a Stop or Pause the user gave first still wins. `continueWithSetup` then continues the task in a new process, unchanged.
- `app/src/registry.ts`: request_setup's description says the turn ends when the call returns; its reply says "Enabled {ids}. The workspace ends this turn and continues the task with them." Both proposals are removed.

**Checks:** `npm run typecheck` clean; `npm test` 122/122 on Windows. New test in `app/test/tasks.test.ts`: a fake agent keeps working after request_setup; the host interrupts it (reason `interrupt`), the turn is done, and the next run continues it with the setup-continue message to completion. Existing request_setup tests updated to the new reply.

**Not verified:** real Claude Code and Codex tasks. The watch relies on each adapter marking the request_setup tool call finished; a turn interrupted before the agent reads the tool result is covered by the continue message, but should be seen once in a test instance.

**Branch:** `agent-instructions` (this worktree), committed locally, not pushed.
