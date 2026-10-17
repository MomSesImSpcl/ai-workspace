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
- **sessions-003 — Durable sessions:** Session history MUST be stored in the workspace's own storage on this computer, never in the project folder ([identity-projects 1.4](../identity-projects/SPEC.md#14-workspace-and-local-projects)), not only in a vendor agent's own session files, so it survives app restarts, agent changes and vendor session expiry. Vendor session ids MAY be kept as hints for continuing a conversation, like task `adapterState`.

## Session list and lifecycle

- **sessions-004 — Session list:** The chat column MUST show the current project's sessions (newest activity first) above or beside the open session, with: new session, rename, archive and delete. A new session gets a provisional title from its first message, which the user can rename. Archived sessions are hidden from the list but searchable and restorable.
- **sessions-005 — Delete is explicit:** Deleting a session MUST ask for confirmation and MUST state that its tasks are kept (they stay in the Tasks view without a session link). Delete removes the session history permanently; archive is the default way to tidy up.
- **sessions-006 — Switching:** Switching sessions or projects MUST NOT stop agent work in the session being left; the list shows which sessions have an agent working.

## Live conversation

- **sessions-007 — Live activity in the chat:** While an agent works, the session MUST show its reply as it is written (streamed) and a live activity list of what it does (for example "Reading `app.ts`", "Editing `ui.html`", "Running tests", "Started task …"). The activity is derived from the agent's events (sessions-020), never guessed.
- **sessions-008 — Collapse on success, keep on interruption:** When the agent's turn completes successfully, its activity list MUST collapse into one line (for example "Worked 2 min · 6 steps ▸") that expands on click; the final answer stays fully visible. When the turn is cancelled, fails, or is interrupted (app or computer shutdown, crash), the activity list MUST stay expanded and end with a marker naming the last completed step (for example "⚠ Interrupted after step 4: editing `ui.html`"). Activity is never deleted by collapsing.
- **sessions-009 — Resume from state, not from the transcript:** Continuing an interrupted turn or task MUST rely on durable state (task checkpoints, [task-runtime](../task-runtime/SPEC.md), and the turn-start project state, sessions-021), not on the chat display. The interruption marker MUST be passed to the agent as context when the user continues, so user and agent see the same last step.
- **sessions-010 — Interrupt:** The user MUST be able to stop the agent's current turn from the session (Stop) and then continue with a new message. Stopping a turn MUST NOT cancel tasks the session started; those have their own controls.

## Closing the app

Agents run on the user's computer (the agent CLI); only the model runs at the provider. Work therefore continues after the window closes but stops when the computer shuts down; running without the computer belongs to [runners](../runners/SPEC.md).

- **sessions-011 — Replies finish in the background:** Closing the window while an agent is replying in a session MUST let that turn finish and save it; reopening the session shows the answer. No new turn starts without a user message.
- **sessions-012 — Tasks continue by default; ask when it matters:** Closing the window MUST NOT cancel tasks by default ([desktop-client 2.1](../desktop-client/SPEC.md#21-desktop-client)). If tasks are running at close, the app MUST ask: "N tasks are still running" with **Keep running** (default) and **Cancel all**, plus "Don't ask again". The remembered choice MUST be shown and changeable in Settings. Without running tasks, closing asks nothing.
- **sessions-013 — Visible after close:** While agent work continues after the window is closed, the app MUST show that it is still working (for example a tray icon with "N running" that reopens the window). Quitting from there follows sessions-012.

## Relation to the interim chat-as-task build

The desktop app's current chat column ([history](../../history/2026-10-17-04-chat-as-task/SUMMARY.md)) treats each chat as one task: the first message is the goal and replies continue that task. This feature supersedes it. Existing task conversations MUST remain readable after the switch, for example shown as read-only sessions or in the task details; they are not converted into live sessions automatically.

## Non-goals

Sharing sessions between projects or users, real-time collaboration in one session, cloud execution while the computer is off ([runners](../runners/SPEC.md)), and long-term memory extraction from sessions ([memory](../memory/SPEC.md)).

## Projects, agents and context

- **sessions-014 — Global sessions:** The session column MUST show, below the project's sessions, a **Global** section with its own sessions and a **New global session** action, for conversations that belong to no project. Global sessions run in the workspace folder ([identity-projects 1.4](../identity-projects/SPEC.md#14-workspace-and-local-projects)) and need it to be set; the agent can therefore reach every project inside it, governed by its own permissions (ADR 0004). Global sessions cannot start tasks that need a project. (Changed with the user 2026-10-17: previously a General space in an empty folder.)
- **sessions-026 — Pinned sessions:** A session MAY be pinned from its menu; pinned sessions are listed first within their section, marked, and MAY be reordered by drag and drop. Unpinning returns a session to the activity order.
- **sessions-015 — Switchable agent:** The composer MUST show the session's agent, model and effort, offering only what that agent's catalog lists ([onboarding-008](../onboarding/SPEC.md)). A new session starts from layered defaults, most specific first: the user's choice in the composer, the project's default (sessions-017), the workspace's Chat role in Settings. The user MAY switch the agent of an existing session, which is expected to be rare because the chat agent acts as the orchestrator: the switch asks for confirmation, is refused while the agent works, and is marked in the chat; the new agent MUST receive the conversation so far as text plus the session's context layers (sessions-016), and vendor session hints of the previous agent are dropped. A changed model or effort applies from the next message. The header shows the current agent and model.
- **sessions-016 — Three context layers:** Every agent turn in a session MUST receive three layers; on conflict the more specific wins: **project over workspace over global**.
  1. **Global rules** of the chosen agent on this computer: the agent's own user-level rules and settings (for example the user's global `CLAUDE.md` and Claude Code settings, global `AGENTS.md` and Codex config). They load the way the agent loads them anywhere else ([ADR 0004](../../architecture/decisions/0004-agent-native-permissions.md)). Which apply depends on the chosen agent; after a switch (sessions-015) the new agent's apply.
  2. **Workspace rules:** context and rules that apply to every project in the workspace ([identity-projects 1.4](../identity-projects/SPEC.md#14-workspace-and-local-projects)), edited in the app and stored on this computer only.
  3. **Project rules:** context and rules for this project, stored in the project folder so they travel with its version control and everyone who clones the project gets the same rules: its own instruction files (`AGENTS.md`, `CLAUDE.md`) and the portable project instructions ([identity-projects 1.2](../identity-projects/SPEC.md#12-project-definition)). Rules edited for the project in the app MUST be written to that portable file, not to workspace storage.
  The session MUST show which layers and files were applied, and each layer MUST be viewable from Settings. Tasks started by the session receive the same layers.
- **sessions-025 — The agent's own setup applies without workspace configuration:** A session MUST start the chosen agent so that everything the user installed or configured for that agent loads the way it does anywhere else: plugins, skills, hooks, MCP servers, rules, settings and their `env` (for example a model proxy), output style. The workspace MUST NOT require the user to register, copy or enable any of them again, and MUST NOT override them with variables of its own host process. The session MUST show what the agent reports as loaded (plugins, MCP servers and their connection state, skill count) so a missing or failed piece is visible. A new plugin installed for the agent applies from the next turn.
- **sessions-017 — Session defaults from the project:** Each project has a default model, effort and optional token cap per role; a new session starts with them and the user MAY change them for that session in the composer; tasks the session starts inherit the session's values. The default token cap is **none**.

## Permissions, events and recovery

Decided in [ADR 0004](../../architecture/decisions/0004-agent-native-permissions.md): permissions live with the agent and the version-control host; the workspace shows and records, it does not add a permission layer.

- **sessions-018 — Permission summary and warnings:** The agent MUST start in the project folder. At session start the session MUST show a one-line summary of the agent's effective permissions (for example "Claude Code: edits allowed in project · Bash: asks · Push: denied"), read from the agent's own settings. It MUST warn visibly when the agent runs in a skip-all-permissions mode, and MUST flag in the chat any write outside the project folder seen in the events.
- **sessions-019 — Approval cards:** When the agent's own rules say "ask", the request MUST appear in the session as an approval card (what, where, Allow / Deny); the answer goes back to the agent. A headless run MUST NOT turn "ask" into a silent deny or allow. Pending approvals are visible in the session list (sessions-006).
- **sessions-020 — One event contract:** Every adapter MUST report the same events: text as written, activity (tool call, command, edited file), approval request, usage, done, error. Every event MUST be stored in the workspace audit log; the chat display (sessions-007/008) is built from it. Shell commands are recorded as commands; their file effects show through version control (sessions-021).
- **sessions-021 — Turn-start project state:** Before each turn the workspace MUST record the project's version-control state (for Git: current commit and changed files; no commits are created). After an interruption, the session MUST show what changed since the turn started, and the continuation MUST give the agent the interruption marker plus that change list so it checks state instead of repeating steps. Without version control, the edited-file events are used instead.
- **sessions-022 — Usage always visible:** Token usage of the running turn or task MUST be shown live and prominently in the session and task views, so the user can stop at any time; per-project totals are shown in the Overview. Stop (sessions-010) ends the agent process; usage keeps being counted up to that point.
- **sessions-023 — Cost estimate as a range:** Before an agent starts a task, the workspace SHOULD show one estimated token range for the chosen model and effort (for example "≈ 20k–80k tokens"), always labelled as an estimate and never as a single number. By default it comes from the project's own history of similar tasks and costs no tokens; with too little history it says so. An optional setting (off by default, with a note that it costs tokens) lets the agent estimate before starting; when enabled, its range replaces the history-based one, so only one estimate is ever shown.
- **sessions-024 — Safety stops instead of guessed caps:** A task MUST pause, not fail, when the agent reports a provider usage or rate limit, showing when it resets, and MAY resume after it. A task MUST also pause after a configurable number of steps without visible progress (no new messages, no edited files) and on its step limit. An optional token cap (sessions-017) still pauses through the existing budget mechanism ([task-runtime 4.6](../task-runtime/SPEC.md#46-scheduling-and-budgets)).

## Open decisions

- **Turn process:** decided in [ADR 0008](../../architecture/decisions/0008-session-host-process.md): one long-lived Claude Code process per session (earlier, [ADR 0005](../../architecture/decisions/0005-session-turn-runner.md): one agent process per turn first (simple, crash-safe, a few seconds of startup); a process kept open per session only if the startup delay proves annoying.)
- **Codex protocol:** decided for now in ADR 0005: stay on `codex exec` ([#14](https://github.com/MomSesImSpcl/ai-workspace/issues/14)). Native thread resume works (checked); approvals, streaming and interrupt need the experimental `codex app-server` protocol instead of `codex exec`. Whether to build on an experimental protocol now or accept fewer Codex features until it is stable. Per-integration status is tracked in the [integration matrix](../../INTEGRATIONS.md).

## Acceptance checks

- Project TEST with three sessions and project BLABLA with four: each project's list shows only its own sessions; opening one shows only its history.
- A message in a session streams the reply and shows live activity; on success the activity collapses to one line and expands on click.
- Stopping a turn mid-reply leaves the activity expanded with an "interrupted after step N" marker; a new message continues the conversation, and the agent receives the marker.
- Killing the agent process (simulated shutdown) during a turn leaves the same expanded activity and marker after restart.
- A session starts a task; the task shows inline in the session and lists its session in the Tasks view; deleting the session after confirmation keeps the task.
- Closing the window with two running tasks asks Keep running / Cancel all; Keep running leaves both running with a visible tray indicator; with "Don't ask again" the next close uses the remembered choice, which Settings shows and can change. Closing with no running tasks asks nothing.
- After the switch from the interim build, conversations of earlier chat-as-task tasks are still readable.
- A General session answers a question without a project; a request to read a file there is refused with a clear message.
- Switching a session from Claude Code to Codex: Codex's next reply shows it received the earlier conversation; the session marks the switch.
- With a rule in the global `CLAUDE.md`, one in workspace rules and one in the project's `AGENTS.md`, a Claude Code session follows all three and lists them as applied; on a conflict the project rule wins.
- With several Claude Code plugins and MCP servers installed for the user and nothing configured in the workspace, a session lists them as loaded and uses them; a newly installed plugin appears from the next turn; an MCP server that fails to connect is flagged.
- A new session starts with the project's defaults (no token cap); changing them in the composer affects only that session and its tasks.
- With Claude Code set to "ask" for Bash, a command request appears as an approval card; Deny is passed back and the agent continues without running it. With push denied in the agent's settings, the summary line shows "Push: denied".
- An agent write outside the project folder is flagged in the chat and recorded in the audit log.
- After killing the agent mid-turn in a Git project, the session lists the files changed since the turn started, and the agent's continuation receives that list.
- Before a task starts, one token range is shown (history-based, or the agent's own when the setting is on); usage counts up live during the run.
- A provider usage limit pauses the task with its reset time instead of failing it.
