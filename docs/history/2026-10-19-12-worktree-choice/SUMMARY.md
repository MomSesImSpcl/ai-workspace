# Worktree chosen per chat

The user asked (2026-10-19) to make worktree creation deliberate, so a new chat can continue a branch, for example after another session's cache went cold. A new chat in a project with worktrees now starts only after the user picks "New worktree" or an existing workspace-made worktree in the composer (no preselection, the user's choice). The "New worktree per session" switch is unavailable for folders outside git. [ADR 0014](../../architecture/decisions/0014-worktree-per-session.md) amended; [details](DETAILS.md).
