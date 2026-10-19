# Desktop workspace and Task Center

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 2.1 Desktop client

- Full workspace interface with project selection, interactive AI sessions, task list, task details, artifacts, model selection, search, relevant files, logs and local runner management.
- Support native desktop integrations as needed: dialogs, notifications, clipboard, deep links, filesystem/file associations, credential storage and process status.
- The client does not own long-running task state. Closing it must not automatically cancel delegated tasks.
- Permit multiple interactive conversations and quick transitions between a conversation and its delegated tasks.
- Include a **Task Center** showing `queued`, `waiting-for-runner`, `running`, `paused`, `blocked/approval-needed`, `failed`, `cancelled` and `completed`. Do not invent numerical progress percentages when only step/status progress is known; show verified steps and logs instead.
- Task controls: the Task Center is a view, not where work is started or steered ([ADR 0010](../../architecture/decisions/0010-tasks-started-from-chat.md)). Per task it MUST show the prompt that started it and the session it belongs to, what it is working on now, its current step and its token consumption against the budget, and MUST offer **Cancel**, plus **Pause** and **Resume** ([runtime-006](../task-runtime/SPEC.md#47-agent-native-tasks)). Starting tasks, approvals, replies, resume and the other controls (priority, checkpoint, retry, clone, artifacts, review, model override, merge/accept) belong to the chat that started the task or to the orchestrator. The stopgap start form, approvals, reply and resume were removed with sessions-002; a task started outside a chat (CLI) still shows its pending approvals in the Task Center, since it has no chat.
- **desktop-001 — Settings overlay with tabs (user, 2026-10-19):** Settings MUST open as an overlay on top of the interface, not as a column that narrows it. It MUST be anchored at the tool rail and cover everything right of the sessions column, which stays visible. The covered area MUST get a light backdrop; Esc or a click on the backdrop closes Settings. Settings MUST be split into tabs: **General** (workspace folder, workspace storage), **Agents** (the agent for each role, orchestrator instructions) and **Agent setup** (rule switches and items per role and agent). The last open tab MUST be restored when Settings opens again, also after a restart. New settings join the tab they fit; a new tab (for example Permissions for [permissions-001](../agent-permissions/SPEC.md)) is added when its feature is built.

**Product acceptance:** G3 in [acceptance scenarios](../../ACCEPTANCE.md).
