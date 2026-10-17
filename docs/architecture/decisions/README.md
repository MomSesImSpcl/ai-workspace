# Architecture decision records

One ADR per significant decision; rules in the [working agreement](../../WORKING_AGREEMENT.md#architecture-decision-records). Check this index for the ADRs that govern an area before changing it.

| ADR | Title | Status | Affected features |
|---|---|---|---|
| [0001](0001-core-slice-stack.md) | Core slice 1: TypeScript CLI with agent-CLI adapters | accepted 2026-10-16 | task-runtime, model-routing, tool-broker, identity-projects, ai-orchestrator |
| [0002](0002-task-center-local-web-ui.md) | Task Center slice 1: local web UI over the core | accepted 2026-10-16 | desktop-client, task-runtime |
| [0003](0003-electron-workspace-shell.md) | Electron workspace shell with an IDE-style layout (supersedes 0002's stack) | accepted 2026-10-17 | desktop-client |
| [0004](0004-agent-native-permissions.md) | Agents use their own tools and permissions; the workspace observes (supersedes parts of 0001) | accepted 2026-10-17, not implemented | sessions, version-control, tool-broker, model-routing, task-runtime |
