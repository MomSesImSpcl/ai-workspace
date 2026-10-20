# Write guard for the running instance

selfdev-002: agents can no longer write to the running app's checkout or the workspace's storage outside their own folder. Claude Code gets a `PreToolUse` hook in every run, and Codex has guarded approval requests declined and worktree sessions in its `workspace-write` sandbox. Built on `claude/great-ride-93ynxs`, not merged; Windows runs with the real agents pending. [ADR 0015](../../architecture/decisions/0015-write-guard.md); [details](DETAILS.md).
