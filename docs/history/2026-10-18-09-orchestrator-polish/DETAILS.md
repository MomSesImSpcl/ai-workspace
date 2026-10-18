# 2026-10-18 — Orchestrator branch after the user's test, merged into `main`

Branch `claude/orchestrator-2bfd92`, after [2026-10-18-07](../2026-10-18-07-task-routing/SUMMARY.md). Each item was asked for by the user while testing in the app; commits are on the branch.

## Tasks and runs

- Task title: `start_task` takes a short `title`; the goal comes first in a `basedOn` task, so the card names the new task. The orchestrator can rename a task of its chat (`rename_task`).
- Task details: one bubble per run (start, then each reuse), one open at a time, with the open/closed state remembered. A Resume joins the run it paused ("paused 1×"); a `resume` flag on the user event marks it.
  - The ID is right-aligned in the title row, and the title is cut with "…" and shown in full on hover.
  - The steps foldout lists numbered steps, one line each with the full text on hover; the step being worked on is blue, and there is no foldout without steps.
  - Agent · model · effort, Started and Finished rows. "Request that started the task" shows the chat message.
  - Agent process output appears only when there is some.
- Live tokens: the agent's streamed usage is recorded every 2 s (`live-usage` event). Hovering a token figure shows the breakdown by token kind, with a Subtasks line where present.
- Step labels: Claude Code's `PowerShell` tool shows its command, and other tools show their first text argument. Labels keep up to 400 characters.

## Chat

- The task card is a thread: the result, each reply "to the task", and each answer, with the reply field at the bottom (Enter sends).
- The reply field goes directly to the task's agent (option 2, under test). The chat records it as a `relay` event, and the orchestrator hears it before the user's next message; option 1 (through the orchestrator) is kept in ADR 0011.
- Hook notices appear in the task thread. In test runs, `/clear` gets past the user's `cache-tax` hook (memory note).
- Markdown in replies, task threads and results, using `marked` 15.0.12 pinned exactly. Raw HTML is shown as text, only `http(s)` and `mailto` links are kept, and images become links.
- Layout: each request with its reply and task card is one block (6 px inside, 26 px between). The folded "Worked" line sits beside the request at its bottom edge.
- The header shows the session's token total (orchestrator plus its tasks, split on hover), left of the title.
- Task permission menu styled like Claude's mode menu ("Permissions"), default `acceptEdits`, with a confirmation before Bypass.

## Orchestrator

- Goals sized to the task.
- The user's own "Orchestrator instructions" in Settings (`settings.json`), which take precedence where they conflict.
- It says when it starts a new task.

## Tasks page and app shell

- The task list is per session, with a grouped Project view (Global in a global chat).
- Counters: the top right counts the project or all global sessions; the line under the chat counts the open session.
- The taskbar blinks while a task waits for approval.
- Page titles have their description beside them.
- Restart: the old instance releases the single-instance lock, saves the window, stops the server, starts the new instance itself and exits; the new one ends a hung old one (only if the PID is still `electron.exe`). `startup.log` in the app's data folder records each step.
- Fixed: stale loads after switching task, session or project; a text selection blocking a switch; a crash when the page signalled the taskbar during a restart.

## Performance

Parsed session files and logs are cached, logs are read incrementally, the session list is built once per request, and refreshes never overlap (interval 1 s). On a copy of the user's storage, warm: session list 577 → 53 ms, task list 339 → 64 ms, largest session 436 → 65 ms.

## Checks

`npm run typecheck` clean; `npm test` 48/48. CI green on Windows, Ubuntu and macOS for the branch head. UI changes checked in the browser on a scratch store; the taskbar blink and the new restart path are checked only by the user in the real app.
