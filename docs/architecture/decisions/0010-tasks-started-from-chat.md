# ADR 0010 — Tasks are started and steered from chat; the Task Center only shows them

Status: accepted (2026-10-18, chosen by the user); not implemented. Changes [desktop-client 2.1](../../features/desktop-client/SPEC.md#21-desktop-client) task controls, [sessions-002](../../features/sessions/SPEC.md#projects-agents-and-context) and [task-runtime 4.1](../../features/task-runtime/SPEC.md#41-two-top-level-work-modes).

## Decision

- Tasks are started by the orchestrator ([ai-orchestrator](../../features/ai-orchestrator/SPEC.md)) or by an agent in a session (sessions-002), never by the user from a form.
- The chat that started a task is its primary place: approval cards, replies and results appear there.
- The Task Center shows each task's starting prompt and session, what it is working on, its current step and token consumption, and offers Cancel. It has no other controls.
- Until the orchestrator and sessions-002 are built, the start form, approvals, reply and resume of [ADR 0009](0009-tasks-are-sessions.md) stay in the Task Center as a stopgap; they are removed in the change that builds the first of them which can start tasks and show their approvals in chat.

## Consequences

- No second place to steer a task, so a task's conversation is never split between chat and Task Center.
- Until the stopgap is removed, the Task Center keeps controls this ADR removes.
