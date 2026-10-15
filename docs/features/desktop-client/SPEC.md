# Desktop workspace and Task Center

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 2.1 Desktop client

- Full workspace interface with project selection, interactive AI sessions, task list, task details, artifacts, model selection, search, relevant files, logs and local runner management.
- Support native desktop integrations as needed: dialogs, notifications, clipboard, deep links, filesystem/file associations, credential storage and process status.
- The client does not own long-running task state. Closing it must not automatically cancel delegated tasks.
- Permit multiple interactive conversations and quick transitions between a conversation and its delegated tasks.
- Include a **Task Center** showing `queued`, `waiting-for-runner`, `running`, `paused`, `blocked/approval-needed`, `failed`, `cancelled` and `completed`. Do not invent numerical progress percentages when only step/status progress is known; show verified steps and logs instead.
- Task controls: create, inspect, add instructions, change priority, request checkpoint, pause/resume, cancel, retry, clone task, view artifacts, review changes, choose/override model, and merge/accept output where appropriate.

**Product acceptance:** G3 in [acceptance scenarios](../../ACCEPTANCE.md).
