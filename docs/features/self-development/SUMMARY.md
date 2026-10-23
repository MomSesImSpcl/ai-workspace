# Developing the workspace inside itself

**Status:** in-progress: worktree per session (selfdev-001, ADR 0014) and write guard for the running instance (selfdev-002, ADR 0015), verify and merge through the workspace after approval (selfdev-003/004, ADR 0017) built; read-only worktree status resolves filesystem aliases ([PR #61 CI repair](../../history/2026-10-21-07-read-repo-path-identity/SUMMARY.md)); restart onto new code and fallback to the last working version (selfdev-005/006, ADR 0018) built; test instance from the worktree (ui-verification) not built; binding check before work and publication with explicit continuation in a new chat (selfdev-008, ADR 0019) built; test instance of a branch (selfdev-009, ADR 0020) built for [#62](https://github.com/MomSesImSpcl/ai-workspace/issues/62) and covered by automated tests ([history](../../history/2026-10-22-05-binding-check-and-continuation/SUMMARY.md)); M1 acceptance blocked pending verification of #62 in the app ([decision](../../history/2026-10-21-10-m1-publication-acceptance-gate/SUMMARY.md))

Let the user develop AI Workspace from within AI Workspace without risking the running instance: agents change code in an isolated worktree, a separate test instance verifies it, and the running app takes the change only after review, through a restart that keeps sessions and tasks and can fall back to the last working version.

[Full requirements](SPEC.md).

**Dependencies / related features:** [version-control](../version-control/SUMMARY.md), [sessions](../sessions/SUMMARY.md), [ui-verification](../ui-verification/SUMMARY.md), [code-index](../code-index/SUMMARY.md), [software-workflow](../software-workflow/SUMMARY.md), [desktop-client](../desktop-client/SUMMARY.md).
