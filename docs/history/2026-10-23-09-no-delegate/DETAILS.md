# 2026-10-23: `delegate` removed

**Scope:** [ADR 0024](../../architecture/decisions/0024-no-delegate.md) (user), part of iteration one of [ADR 0023](../../architecture/decisions/0023-one-agent-interface.md); replaces the planned increment "workspace tools for Codex subtasks". Effort: medium (user).

**Outcome:**
- `app/src/approval-server.ts`: no `delegate` tool. `app/src/tasks.ts`: no `delegate` function; a task calling `start_task` is told "Tasks do not start tasks: name the follow-up work in your result, and the chat starts it".
- `app/src/setup.ts`: no Delegate setup item; `app/src/adapters/*`: not listed, no delegate activity labels, no `mcp__aiws__delegate` in a task's allowed tools.
- `app/src/prompt.ts`: no delegate note.
- `app/src/instructions.ts`: the Subtask role, "Delegate subtasks", the `delegate` tool and its replies removed; wording no longer mentions subtasks (39 entries, roles Chat, Orchestrator, Implementer).
- `task.parentId` stays, so subtasks recorded before keep showing under their parent.
- Specs: task-runtime (who starts tasks, runtime-001), ai-orchestrator (setup items), onboarding-010, tool-broker summary, ui-verification example. ADR 0001 and 0007 marked superseded in part.

**Checks:** `npm run typecheck` clean; `npm test` 114/114 on Windows (the delegate test removed; the server tool list for a task is now approve, read_repo, request_setup; a task's `start_task` refusal checked).

**Not verified:** in the app.

**Branch:** `agent-instructions`, uncommitted.
