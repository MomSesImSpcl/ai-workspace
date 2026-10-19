# Worktree per session (selfdev-001)

Built 2026-10-19 on the user's decisions ([ADR 0014](../../architecture/decisions/0014-worktree-per-session.md)): a per-project "New worktree per session" switch, on by default for the repository the running app starts from; worktrees in workspace storage on branch `aiws/<session>` from the checkout's HEAD, made at the first turn with a notice; a chat's tasks and subtasks share its worktree; a removed worktree stops the session with an error. First M1 slice ([selfdev-001](../../features/self-development/SPEC.md#requirements)). [Details](DETAILS.md).
