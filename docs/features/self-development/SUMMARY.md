# Developing the workspace inside itself

**Status:** in-progress: worktree per session (selfdev-001, ADR 0014) and write guard for the running instance (selfdev-002, ADR 0015), verify and merge through the workspace after approval (selfdev-003/004, ADR 0017) built; verify, restart and fallback not built

Let the user develop AI Workspace from within AI Workspace without risking the running instance: agents change code in an isolated worktree, a separate test instance verifies it, and the running app takes the change only after review, through a restart that keeps sessions and tasks and can fall back to the last working version.

[Full requirements](SPEC.md).

**Dependencies / related features:** [version-control](../version-control/SUMMARY.md), [sessions](../sessions/SUMMARY.md), [ui-verification](../ui-verification/SUMMARY.md), [code-index](../code-index/SUMMARY.md), [software-workflow](../software-workflow/SUMMARY.md), [desktop-client](../desktop-client/SUMMARY.md).
