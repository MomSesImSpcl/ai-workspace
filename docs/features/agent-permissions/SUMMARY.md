# Workspace permission settings for agents

**Status:** not-started (requested by the user 2026-10-18)

In Settings, the user decides what agents may do without asking: write in the project folder, write anywhere, run commands. The workspace applies the choices to each agent run, mapped onto each agent's own permission mechanism. It never changes the user's agent configuration files. This replaces today's per-chat task mode picker as the place to set permissions, while a chat or task can still choose a stricter mode.

[Full requirements](SPEC.md).

**Dependencies / related features:** [task-runtime](../task-runtime/SUMMARY.md) (runtime-003 permission mode), [sessions](../sessions/SUMMARY.md) (sessions-018/019 permission summary and approval cards), [desktop-client](../desktop-client/SUMMARY.md) (Settings), [ai-orchestrator](../ai-orchestrator/SUMMARY.md).
