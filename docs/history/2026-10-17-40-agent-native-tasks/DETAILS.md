# 2026-10-17 — Agent-native tasks (runtime-001–005) and Codex on app-server

Scope agreed with the user: a task is a session (not a second runtime), repeat detection included, Codex moved to `codex app-server` in the same branch. Decision: [ADR 0009](../../architecture/decisions/0009-tasks-are-sessions.md), implementing [ADR 0007](../../architecture/decisions/0007-tasks-agent-native.md).

## Outcome

- runtime-001: tasks start the agent with its own setup; the workspace adds only `approve` and `delegate` (`app/src/approval-server.ts`, server `aiws`).
- runtime-002: "ask" becomes an approval card in the task view and waits without a time limit (`MCP_TOOL_TIMEOUT` at Node's maximum; Codex requests answered when the user decides); status `waiting`.
- runtime-003: permission mode per task from the agent's catalog (`modes`); a mode that skips every check shows a warning.
- runtime-004: fingerprints on activity events; Claude Code `PreToolUse` hook (`app/src/repeat-hook.ts`) holds a repeat as a labelled card; Codex fallback stops and pauses naming the step.
- runtime-005: the cap ends the process tree from streamed usage; cancel ends it at once and cancels subtasks.
- Codex sessions and tasks on `codex app-server`: streaming text, activity, approvals, live usage, `turn/interrupt`, thread resume (#14). One host loop for every agent (`app/src/turn.ts`), which also removes the `integration === 'claude-code'` exception noted in progress.
- Removed: `app/src/runtime.ts`, `broker.ts`, `mcp-server.ts`, `delegate.ts`, the "Allow writes" option, the effect ledger and the per-call budget check. Old task files are migrated into task sessions (`migrateTasks`, run by the CLI at start).
- UI: Tasks page with permission menu, conversation with approval cards, reply, resume with a new budget, cancel, subtasks; task sessions are not listed in the chat column.

## Checks (Windows 10, Claude Code 2.1.301, codex-cli 0.163.0)

- `npm run typecheck` clean; `npm test` 37/37 (new `app/test/tasks.test.ts` with fake Claude Code and fake Codex app-server processes; `core.test.ts` removed with the code it tested).
- Real Claude Code (model sonnet, scratch workspace): `acceptEdits` task created a file and completed; `delegate` ran a Claude Code subtask that answered "pong"; a 60,000 budget paused the task after the first model call (93,920 tokens, mostly prompt cache) and resume refused until the budget was raised; repeat detection held `echo one >> log.txt` as a card labelled "Possible repeat", also under `bypassPermissions`, and denying it kept the command from running.
- Real Codex (user's config, `read-only` mode): the write command arrived as an approval card, the task showed `waiting`, allowing it wrote the file; `delegate` through the `aiws` MCP server ran a Codex subtask ("pong"); a repeated command after an interruption stopped the task as paused with the earlier step named, and the command did not run.
- UI on a scratch store in the browser pane: task list, mode menu with the bypass warning, task detail with conversation, permissions line and subtasks.
- Found while checking: Claude Code drops an `--mcp-config` server named `workspace` without an error, so the server is named `aiws`.

## Limits and issues

- #1 stays open, narrowed: the call that crosses the cap still completes; prompt-cache tokens of a large agent setup count towards it.
- Codex repeat detection compares the command text Codex reports (on Windows wrapped in the PowerShell call); Codex may already have started the command when the stop arrives.
- Closed by this work once merged: #2 (effect ledger removed), #3 (Codex streams usage), #7 (agent-native by decision, ADR 0004/0007), #8 (read-only sandbox path removed), #9 (stale resume falls back to workspace history), #11 (cancel ends the process tree), #14 (Codex on app-server).
- Not run: macOS/Linux, the Electron window itself (the page was checked in the browser pane), approvals waiting across an app restart.

Branch `claude/tasks-feature-b7694b`; commit: see the branch history.
