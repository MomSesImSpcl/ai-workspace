# Chat sessions and project structure

[Shared principles](../../PRINCIPLES.md) and [related features](SUMMARY.md) apply.

## Problem

The workspace needs a place to talk to agents, not only to delegate work. Users know the model from Claude and ChatGPT: several separate chats, each with its own history. Work here is organized by project, so chats must belong to a project and stay apart from other projects. The [interactive session and delegated task modes](../task-runtime/SPEC.md#41-two-top-level-work-modes) and [multiple conversations](../desktop-client/SPEC.md#21-desktop-client) are named elsewhere, but nothing defines how projects, sessions and tasks relate, how a session looks while an agent works, or what closing the app does.

## Structure

```text
Project TEST
├─ Session "Login bug"     → its own history + the tasks it started
├─ Session "Refactor API"
└─ Session "Docs"
Project BLABLA
└─ 4 sessions, separate from TEST's
```

- **sessions-001 — Sessions belong to one project:** Every session MUST belong to exactly one project and is only listed, opened and searched within that project. Sessions of different projects MUST NOT share history. Access follows the project's authorization ([identity-projects](../identity-projects/SPEC.md)).
- **sessions-002 — A session is a conversation; a task is delegated work:** A session holds the conversation (user and agent messages, activity, see sessions-007). A session MAY start delegated tasks ([task-runtime 4.1](../task-runtime/SPEC.md#41-two-top-level-work-modes)); each such task MUST record the session that started it, and the session MUST show the task inline (status, link to its details). A task started outside a session (CLI, mobile, another task) has no session and is still listed in the project's Tasks view.
- **sessions-003 — Durable sessions:** Session history MUST be stored by the workspace, not only in a vendor agent's own session files, so it survives app restarts, agent changes and vendor session expiry. Vendor session ids MAY be kept as hints for continuing a conversation, like task `adapterState`.

## Session list and lifecycle

- **sessions-004 — Session list:** The chat column MUST show the current project's sessions (newest activity first) above or beside the open session, with: new session, rename, archive and delete. A new session gets a provisional title from its first message, which the user can rename. Archived sessions are hidden from the list but searchable and restorable.
- **sessions-005 — Delete is explicit:** Deleting a session MUST ask for confirmation and MUST state that its tasks are kept (they stay in the Tasks view without a session link). Delete removes the session history permanently; archive is the default way to tidy up.
- **sessions-006 — Switching:** Switching sessions or projects MUST NOT stop agent work in the session being left; the list shows which sessions have an agent working.

## Live conversation

- **sessions-007 — Live activity in the chat:** While an agent works, the session MUST show its reply as it is written (streamed) and a live activity list of what it does (for example "Reading `app.ts`", "Editing `ui.html`", "Running tests", "Started task …"). The activity is derived from the audit log and adapter events, never guessed.
- **sessions-008 — Collapse on success, keep on interruption:** When the agent's turn completes successfully, its activity list MUST collapse into one line (for example "Worked 2 min · 6 steps ▸") that expands on click; the final answer stays fully visible. When the turn is cancelled, fails, or is interrupted (app or computer shutdown, crash), the activity list MUST stay expanded and end with a marker naming the last completed step (for example "⚠ Interrupted after step 4: editing `ui.html`"). Activity is never deleted by collapsing.
- **sessions-009 — Resume from state, not from the transcript:** Continuing an interrupted turn or task MUST rely on durable state (task checkpoints and the effect ledger, [task-runtime](../task-runtime/SPEC.md)), not on the chat display. The interruption marker MUST be passed to the agent as context when the user continues, so user and agent see the same last step.
- **sessions-010 — Interrupt:** The user MUST be able to stop the agent's current turn from the session (Stop) and then continue with a new message. Stopping a turn MUST NOT cancel tasks the session started; those have their own controls.

## Closing the app

Agents run on the user's computer (the agent CLI and the workspace's tool server); only the model runs at the provider. Work therefore continues after the window closes but stops when the computer shuts down; running without the computer belongs to [runners](../runners/SPEC.md).

- **sessions-011 — Replies finish in the background:** Closing the window while an agent is replying in a session MUST let that turn finish and save it; reopening the session shows the answer. No new turn starts without a user message.
- **sessions-012 — Tasks continue by default; ask when it matters:** Closing the window MUST NOT cancel tasks by default ([desktop-client 2.1](../desktop-client/SPEC.md#21-desktop-client)). If tasks are running at close, the app MUST ask: "N tasks are still running" with **Keep running** (default) and **Cancel all**, plus "Don't ask again". The remembered choice MUST be shown and changeable in Settings. Without running tasks, closing asks nothing.
- **sessions-013 — Visible after close:** While agent work continues after the window is closed, the app MUST show that it is still working (for example a tray icon with "N running" that reopens the window). Quitting from there follows sessions-012.

## Relation to the interim chat-as-task build

The desktop app's current chat column ([history](../../history/2026-10-17-04-chat-as-task/SUMMARY.md)) treats each chat as one task: the first message is the goal and replies continue that task. This feature supersedes it. Existing task conversations MUST remain readable after the switch, for example shown as read-only sessions or in the task details; they are not converted into live sessions automatically.

## Non-goals

Sharing sessions between projects or users, real-time collaboration in one session, cloud execution while the computer is off ([runners](../runners/SPEC.md)), and long-term memory extraction from sessions ([memory](../memory/SPEC.md)).

## Open decisions

- **Chats without a project:** whether a "General" space exists for questions that belong to no project, or every session needs a project.
- **Agent per session:** whether a session is bound to one agent/role at creation or can switch mid-conversation ([task-runtime 4.1](../task-runtime/SPEC.md#41-two-top-level-work-modes) says a conversation can continue using any model), and how history is handed to a different agent.
- **Shared project context:** which project instructions (and later memory) every new session receives, so sessions do not start knowing nothing about the project.
- **Session budgets and write permission:** per session, per message, or inherited from project settings.
- **Adapter support:** how each agent CLI provides streaming, stop and continuation (Claude Code streams events today; Codex runs one `codex exec` per turn).

## Acceptance checks

- Project TEST with three sessions and project BLABLA with four: each project's list shows only its own sessions; opening one shows only its history.
- A message in a session streams the reply and shows live activity; on success the activity collapses to one line and expands on click.
- Stopping a turn mid-reply leaves the activity expanded with an "interrupted after step N" marker; a new message continues the conversation, and the agent receives the marker.
- Killing the agent process (simulated shutdown) during a turn leaves the same expanded activity and marker after restart.
- A session starts a task; the task shows inline in the session and lists its session in the Tasks view; deleting the session after confirmation keeps the task.
- Closing the window with two running tasks asks Keep running / Cancel all; Keep running leaves both running with a visible tray indicator; with "Don't ask again" the next close uses the remembered choice, which Settings shows and can change. Closing with no running tasks asks nothing.
- After the switch from the interim build, conversations of earlier chat-as-task tasks are still readable.
