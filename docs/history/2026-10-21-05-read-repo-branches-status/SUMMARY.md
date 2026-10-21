# `read_repo` lists branches and status

Agents that cannot run commands can now ask `read_repo` for every local and remote branch with its worktree and ahead/behind counts against `main`, and for `git status --short` of the project checkout or one of its worktrees. Both are read only. [Details](DETAILS.md).
