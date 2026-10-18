# 2026-10-18 — Task routing, queued replies, basedOn, default task mode

## What the user saw

With a Codex orchestrator, "the same website again with another file name" and "now a .txt file" both went to the finished first task. Its card, with new approval cards, stayed under the first turn. Every write and command asked for approval, because tasks ran in the agent's default mode, and the target folder was outside the project.

## Decisions (user, 2026-10-18)

- A message goes to a task only while it runs (or is paused). A finished task gets a new task, unless the user writes in the reply field under it.
- Similar work keeps context through a handoff (`basedOn`), not by reusing the task. A reused task resends its growing history on every call; a new task's fixed setup drops further with the lean setup (orchestrator-005).
- Permission mode: a picker next to the chat box (default `acceptEdits`) for now. Workspace-wide settings ("write in the project", "write anywhere") are a new feature, specified as [agent-permissions](../../features/agent-permissions/SPEC.md).

## Changes

- `app/src/sessions.ts`:
  - The `queued` event, `queueReply` and `queuedReplies`. `addMessage` sends queued replies along with the next message.
  - `Session.taskMode` and `TaskSpec.basedOn`.
  - New routing rule in `ORCHESTRATOR_NOTE`.
- `app/src/turn.ts`: the host sends a task's queued replies once its turn ends as done or failed. A paused task keeps them for Resume.
- `app/src/tasks.ts`:
  - `replyFromSession` refuses a finished task (the error names `basedOn`), queues for a running or paused one, and records the task in the chat's current turn.
  - `replyTask` queues or continues.
  - `handoff` builds the `basedOn` prefix.
  - `DEFAULT_TASK_MODE` is `acceptEdits`, used when the chat picks no mode and the agent offers it.
- `app/src/approval-server.ts`: `start_task` takes `basedOn`; the `reply_task` description says it is for running tasks.
- `app/src/ui.ts`: the task reply route queues while the task works; new session action `mode`; `taskMode` on create.
- `app/src/ui.html`:
  - Task mode picker in the task settings row (`renderCap`).
  - The reply field also shows while a task works.
  - A task's full card shows only in the last turn that names it; earlier turns show "continued below".

## Checks

- `npm run typecheck` clean; `npm test` 46/46. New or changed tests:
  - Queued replies to a running task arrive together as its next message.
  - A finished task is refused, and a `basedOn` task starts with the earlier goal and reply.
  - The default mode is `acceptEdits`, and the chat's mode '' gives the agent's settings.
  - API `mode`.
  - The page script parses. Added after a stray line break broke the page in the browser check.
- Real runs, scratch store, Claude Code (Sonnet) as orchestrator, Claude Code (Haiku) as implementation agent, with every card approved by the test driver:
  - Same three requests as the user's: "index.html with test" started a task in `acceptEdits`. "The same website again with a different file name" started a new task with `basedOn` (it created `index2.html`). "What files are in the project now?" was answered directly. 2 approval cards in all (commands).
  - "Create about.html about cats", then "make it about dogs" while the task ran: the orchestrator called `task_status` and `reply_task`. The reply was queued and arrived when the step ended. The file is about dogs.
- Browser: the first turn shows "continued below", the latest turn the full card; the picker shows "Tasks: Accept edits".
- Not checked: Codex as orchestrator after this change; Electron window.
