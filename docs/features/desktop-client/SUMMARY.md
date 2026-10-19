# Desktop workspace and Task Center

**Status:** in-progress — Electron workspace app: Projects page, per-project Task Center (list, details, cancel; tasks start and are answered in their chat, ADR 0010), sessions column and chat, Settings overlay with tabs (desktop-001); see [ADR 0003](../../architecture/decisions/0003-electron-workspace-shell.md)

Provide project navigation, interactive conversations, task controls, artifacts, search, logs and local runner management. Delegated work survives closing the client; progress reflects verified state and steps.

[Full requirements](SPEC.md).

**Dependencies / related features:** [identity-projects](../identity-projects/SUMMARY.md), [task-runtime](../task-runtime/SUMMARY.md), [sessions](../sessions/SUMMARY.md) (chat sessions per project, close behavior).
