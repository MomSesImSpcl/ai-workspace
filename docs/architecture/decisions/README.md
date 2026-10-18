# Architecture decision records

One ADR per significant decision; rules in the [working agreement](../../WORKING_AGREEMENT.md#architecture-decision-records). Check this index for the ADRs that govern an area before changing it.

| ADR | Title | Status | Affected features |
|---|---|---|---|
| [0001](0001-core-slice-stack.md) | Core slice 1: TypeScript CLI with agent-CLI adapters | accepted 2026-10-16 | task-runtime, model-routing, tool-broker, identity-projects, ai-orchestrator |
| [0002](0002-task-center-local-web-ui.md) | Task Center slice 1: local web UI over the core | accepted 2026-10-16 | desktop-client, task-runtime |
| [0003](0003-electron-workspace-shell.md) | Electron workspace shell with an IDE-style layout (supersedes 0002's stack) | accepted 2026-10-17 | desktop-client |
| [0004](0004-agent-native-permissions.md) | Agents use their own tools and permissions; the workspace observes (supersedes parts of 0001) | accepted 2026-10-17; implemented for sessions (ADR 0005) and tasks (ADR 0009) | sessions, version-control, tool-broker, model-routing, task-runtime |
| [0006](0006-agent-capability-contract.md) | Agent capability contract with fallbacks and a conformance check | accepted 2026-10-17, not implemented | all agent integrations, sessions, task-runtime, model-routing |
| [0007](0007-tasks-agent-native.md) | Tasks run agent-native: approvals, permission mode, repeat detection (supersedes parts of 0001 for tasks) | accepted 2026-10-17; implemented (ADR 0009) | task-runtime, tool-broker, desktop-client |
| [0008](0008-session-host-process.md) | One long-lived Claude Code process per session (supersedes 0005's turn process) | accepted 2026-10-17 | sessions |
| [0009](0009-tasks-are-sessions.md) | Tasks are background sessions; Codex on `codex app-server` (implements 0007; supersedes 0005's Codex on `exec`) | accepted 2026-10-17 | task-runtime, sessions, tool-broker, desktop-client, model-routing |
| [0010](0010-tasks-started-from-chat.md) | Tasks are started and steered from chat; the Task Center only shows them, with Cancel | accepted 2026-10-18, implemented with sessions-002 (stopgap form removed) | desktop-client, sessions, task-runtime, ai-orchestrator |
| [0011](0011-orchestrator-works-through-tasks.md) | The orchestrator chat runs every change request as a task; follow-ups reply to it; the orchestrator picks agent, model and effort; tasks are uncapped unless the user asks for a cap | accepted 2026-10-18, implemented 2026-10-18 | ai-orchestrator, sessions, task-runtime, desktop-client |
| [0005](0005-session-turn-runner.md) | Sessions slice 1: one detached agent process per turn, Codex on `exec` | accepted 2026-10-17 | sessions, desktop-client, model-routing |
