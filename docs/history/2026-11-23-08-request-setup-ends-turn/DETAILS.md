# 2026-11-23: the workspace ends a task's turn after request_setup

**Scope:** first conversion batch of [agent-interface-008](../../features/agent-interface/SPEC.md#requirements) (user picked it). Effort: high.

**Outcome:**
- Event-driven (user, after a first version that polled every 300 ms): adapters tag an activity that calls a workspace tool with its neutral name (`workspaceTool` on the activity event; Claude Code from `mcp__aiws__<tool>`, Codex from an `aiws` MCP tool call). `app/src/turn.ts` (`oneTurn`) watches the turn's own events: when the request_setup call's finished event arrives and the task has items added (`task.setupAdded`), it interrupts the turn like Pause does, keeping the process. The turn is recorded as done, not stopped; a Stop or Pause the user gave first still wins. `continueWithSetup` then continues the task in a new process, unchanged.
- `app/src/registry.ts`: request_setup's description says the turn ends when the call returns; its reply says "Enabled {ids}. The workspace ends this turn and continues the task with them." Both proposals are removed.

**Checks:** `npm run typecheck` clean; `npm test` 123/123 on Windows; `app/test/agents.test.ts` checks both adapters tag the workspace tool. New test in `app/test/tasks.test.ts`: a fake agent keeps working after request_setup; the host interrupts it (reason `interrupt`), the turn is done, and the next run continues it with the setup-continue message to completion. Existing request_setup tests updated to the new reply.

**Not verified:** real Claude Code and Codex tasks. The interrupt is sent from inside the adapter's own event handler; it relies on each adapter reporting the request_setup call finished; a turn interrupted before the agent reads the tool result is covered by the continue message, but should be seen once in a test instance.

**Branch:** `agent-instructions` (this worktree), committed locally, not pushed.
