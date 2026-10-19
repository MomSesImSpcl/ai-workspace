# ADR 0011 — The orchestrator chat runs all work as uncapped tasks

Status: accepted (2026-10-18, chosen by the user); implemented 2026-10-18 ([history](../../history/2026-10-18-06-orchestrator-slice-1/SUMMARY.md)). Changes [orchestrator-004](../../features/ai-orchestrator/SPEC.md#role-and-handoff-requirements), adds orchestrator-006, and changes the token budget of [task-runtime 4.6](../../features/task-runtime/SPEC.md) and [ADR 0010](0010-tasks-started-from-chat.md)'s `start_task`.

## Decision

- Chatting with the orchestrator is for getting something built. Every request to change something becomes a task run by the implementation role; the orchestrator does not do the work itself. Questions about the work (what a task is doing, why it failed) are answered directly, without a task.
- A follow-up or correction to earlier work goes to that task as a reply, not to a new task.
- When a request is too vague to start, the orchestrator asks first. The rule it follows must be clear enough that this is rare.
- The orchestrator chooses each task's agent, model and effort level and shows its choice with a short reason; the user may override it.
- Tasks run uncapped by default. A token cap is set only when the user asks for one: through a switch next to the chat box, or by accepting the orchestrator's suggestion. Details are decided when it is built.
- A separate chat mode for talking and planning without starting tasks is specified as Plan Mode ([orchestrator-007](../../features/ai-orchestrator/SPEC.md#independently-selectable-roles)), not built.

## Implementation decisions (2026-10-18, with the user)

- The orchestrator is a chat session of the Orchestration role, run by that role's agent; no own model loop. A new session starts as the orchestrator; Chat stays selectable.
- Its own edit and command tools are blocked by the workspace, keyed on the role, not the agent: switching which agent orchestrates and which implements keeps the implementation agent unblocked.
- Routing rule: a correction to a task of the chat goes to it with `reply_task`; anything to be done becomes a task with `start_task`; a question is answered directly, with `task_status` and read-only tools. Pause, Resume and Change are buttons, not orchestrator tools.
- (Removed 2026-10-19 as unused, user: the cap is asked of the orchestrator in words; a chat that already has a cap keeps it.) The cap switch next to the chat box sets the chat's cap for the tasks it starts; unchecked, tasks run uncapped. Card and switch layout live in small functions of `ui.html`, so they can be reworked.
- Token cost weights (onboarding-009), the planner handoff (orchestrator-002) and the lean setup (orchestrator-005) stay for later.

## Change (2026-10-18, chosen by the user after testing)

The first rule ("a follow-up or correction goes to that task") reused finished tasks for new, similar work. Their approval cards then appeared under an old turn. Replaced by:

- A message goes to a task only while that task is running or paused; it is queued until the current step ends.
- Anything for a finished task becomes a new task, which names the earlier one (`basedOn`) and starts with its goal and last reply.
- The user continues a finished task with the reply field under its card.
- The card moves to the turn that last sent the task a message.

## Reply field under a task: under test (2026-10-18, chosen by the user)

Two designs were weighed for text the user types under a task's card:

1. **Through the orchestrator.** The text becomes a chat message tagged for that task, and the orchestrator forwards it with `reply_task` (then allowed for a finished task). The orchestrator can check or rewrite it first. Cost: one orchestrator turn and its delay per reply.
2. **Direct, and the orchestrator is told.** The text goes to the task at once. The chat records it (`relay` event, shown as the user's message "to task …"), and the orchestrator's agent gets it as a note before the user's next message.

Option 2 is built for testing. Revisit option 1 if the orchestrator needs to review or steer what the user sends to tasks; the switch is in `ui.ts` (task reply route) and `relayToChat` in `tasks.ts`.

Why a handoff instead of reuse: a reused task resends its whole growing history on every model call. A new task pays a fixed setup, which drops further once tasks run lean (orchestrator-005).

## Consequences

- The orchestrator's own context stays small; implementation happens in tasks, visible with Cancel in their chat and in the Task Center.
- An uncapped task runs until it ends, is cancelled, or the plan's usage limit stops it, the same as a normal agent chat; the difference is that it runs in the background.
- `start_task` drops the required token budget; the cap becomes optional.
