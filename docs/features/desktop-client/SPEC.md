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
- **desktop-002 — Accent colour (user, 2026-10-19; specified, not built):** Settings → **General** MUST offer an accent colour choice: a row of about six preset swatches, the current warm orange (`#d97757`) first and the default, plus **Custom…**, which opens a colour picker for any colour. The app MUST derive the whole accent token family (`--accent`, `--accent-bright`, `--accent-strong`, `--accent-dim`, `--accent-edge`, `--on-accent`) from the one chosen colour; nothing outside these tokens may change, so components keep using only the `--accent*` tokens. Derived colours MUST stay readable: `--on-accent` text on `--accent-strong` MUST reach WCAG AA contrast (4.5:1), and `--accent` used as text or icon on the panel background MUST reach 3:1; when a custom colour misses this, the derived shades are adjusted in lightness (hue kept) until it passes, and the picker shows the adjusted result. Presets MUST pass without adjustment. The choice is a UI preference stored with the other UI prefs (`/api/prefs`), not in workspace or project settings, and is restored after a restart. It MUST apply immediately to the open window without restart or reload, and **Reset** returns to the default. Non-goals: full themes, light/dark switching, per-project colours.

**Product acceptance:** G3 in [acceptance scenarios](../../ACCEPTANCE.md).
