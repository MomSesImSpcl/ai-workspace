# Write guard: Windows test

PR #19's code ran as a separate app instance with its own storage, with real Claude Code (Haiku) and Codex (GPT-5.6-Luna) chats in new app-project worktrees (user, 2026-10-20). Both could write and commit in their worktree; writes to the live checkout, its `.git/hooks` and the storage folder were blocked. #19 merged, #20 closed; new limits #21 (M1) and #22. [Details](DETAILS.md).
