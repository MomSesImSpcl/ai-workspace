# Workspace backup, transfer and private sync

**Status:** in-progress: export and import (transfer-001–006); private sync (transfer-101–105) specified, not started

Moves a user's workspace storage (sessions, tasks, logs, project list, settings) between computers. Export writes one file, import merges it into another workspace and maps project folders to that computer. Credentials and machine-only files never leave. A later, opt-in part syncs the storage through a private, encrypted Git repository; it changes the "never synced" rule and needs its own decision.

[Full requirements](SPEC.md).

**Dependencies / related features:** [identity-projects](../identity-projects/SUMMARY.md) (workspace and storage layout, 1.4), [sessions](../sessions/SUMMARY.md), [task-runtime](../task-runtime/SUMMARY.md), [version-control](../version-control/SUMMARY.md).
