# Merging through the workspace after approval

selfdev-003/004, M1 step 2 C: app-project chats and top-level tasks report typecheck and test results and merge into `main` only through the workspace tool `request_merge`, which opens the pull request if needed, asks the user with one card and squash-merges on Allow. Agents cannot merge themselves (guard; no `gh` login in Codex's worktree shells). Branch `claude/great-ride-93ynxs`. [ADR 0017](../../architecture/decisions/0017-merge-through-workspace.md); [details](DETAILS.md).
