# Codex runs linked programs in its sandbox

Fixes #21 (to confirm on Windows): Codex's Windows sandbox could not run `rtk` through WinGet's link in `Links`, so the user's `rtk` hook broke `git` in Codex worktree chats. The workspace now starts Codex with each linked program's real folder on the PATH, before the link. Branch `claude/great-ride-93ynxs`. [Details](DETAILS.md).
