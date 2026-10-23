# ADR 0024: Tasks do not start tasks; `delegate` is removed

## Status

accepted 2026-10-23 (user), implemented 2026-10-23. Supersedes the delegation part of [ADR 0001](0001-core-slice-stack.md) and the `delegate` tool kept by [ADR 0007](0007-tasks-agent-native.md).

## Context

`delegate` came with the first slice (ADR 0001), before the orchestrator existed: a running task could start a subtask under another role's agent and wait for its reply. Since [ADR 0011](0011-orchestrator-works-through-tasks.md) the orchestrator starts all work as tasks, choosing agent, model and effort with a reason the user sees. Reading every agent instruction (the agent instructions browser) showed what `delegate` still cost: its own tool, note, setup item, depth limit, budget rules and a separate Subtask role, plus a gap (Codex subtasks had no workspace tools). Under [ADR 0023](0023-one-agent-interface.md) every such special case is unwanted.

## Decision

- The workspace tool `delegate`, its instruction note and the Delegate setup item are removed. A task cannot start tasks; `start_task` refuses with "Tasks do not start tasks: name the follow-up work in your result, and the chat starts it".
- A task that finds separate work finishes and names it in its result; the orchestrator or the user starts it as a task of the chat, visible from the start.
- Subtasks recorded before this decision (`task.parentId`) keep showing under their parent and can still be resumed; no new ones are made.

## Rejected alternatives

- Keeping `delegate` and giving Codex subtasks the workspace tools: closes one gap but keeps a second way to start work, outside the orchestrator's choice and the user's view.

## Consequences

- One place decides about work: the chat (orchestrator or user).
- A task can no longer get help mid-run without ending; follow-up work starts after it.
