# Developing the workspace inside itself

**Status:** not-started

Let the user develop AI Workspace from within AI Workspace without risking the running instance: agents change code in an isolated worktree, a separate test instance verifies it, and the running app takes the change only after review, through a restart that keeps sessions and tasks and can fall back to the last working version.

[Full requirements](SPEC.md).

**Dependencies / related features:** [version-control](../version-control/SUMMARY.md), [sessions](../sessions/SUMMARY.md), [ui-verification](../ui-verification/SUMMARY.md), [code-index](../code-index/SUMMARY.md), [software-workflow](../software-workflow/SUMMARY.md), [desktop-client](../desktop-client/SUMMARY.md).
