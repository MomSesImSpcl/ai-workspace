# ADR 0011 — The orchestrator chat runs all work as uncapped tasks

Status: accepted (2026-10-18, chosen by the user); implemented 2026-10-18 ([history](../../history/2026-10-18-06-orchestrator-slice-1/SUMMARY.md)). Changes [orchestrator-004](../../features/ai-orchestrator/SPEC.md#role-and-handoff-requirements), adds orchestrator-006, and changes the token budget of [task-runtime 4.6](../../features/task-runtime/SPEC.md) and [ADR 0010](0010-tasks-started-from-chat.md)'s `start_task`.

## Decision

- Chatting with the orchestrator is for getting something built. Every request to change something becomes a task run by the implementation role; the orchestrator does not do the work itself. Questions about the work (what a task is doing, why it failed) are answered directly, without a task.
- A follow-up or correction to earlier work goes to that task as a reply, not to a new task.
- When a request is too vague to start, the orchestrator asks first. The rule it follows must be clear enough that this is rare.
- The orchestrator chooses each task's agent, model and effort level and shows its choice with a short reason; the user may override it.
- Tasks run uncapped by default. A token cap is set only when the user asks for one: through a switch next to the chat box, or by accepting the orchestrator's suggestion. Details are decided when it is built.
- A separate chat mode for talking and planning without starting tasks is planned and not yet specified.

## Implementation decisions (2026-10-18, with the user)

- The orchestrator is a chat session of the Orchestration role, run by that role's agent; no own model loop. A new session starts as the orchestrator; Chat stays selectable.
- Its own edit and command tools are blocked by the workspace, keyed on the role, not the agent: switching which agent orchestrates and which implements keeps the implementation agent unblocked.
- Routing rule: a correction to a task of the chat goes to it with `reply_task`; anything to be done becomes a task with `start_task`; a question is answered directly, with `task_status` and read-only tools. Pause, Resume and Change are buttons, not orchestrator tools.
- The cap switch next to the chat box sets the chat's cap for the tasks it starts; unchecked, tasks run uncapped. Card and switch layout live in small functions of `ui.html`, so they can be reworked.
- Token cost weights (onboarding-009), the planner handoff (orchestrator-002) and the lean setup (orchestrator-005) stay for later.

## Consequences

- The orchestrator's own context stays small; implementation happens in tasks, visible with Cancel in their chat and in the Task Center.
- An uncapped task runs until it ends, is cancelled, or the plan's usage limit stops it, the same as a normal agent chat; the difference is that it runs in the background.
- `start_task` drops the required token budget; the cap becomes optional.
