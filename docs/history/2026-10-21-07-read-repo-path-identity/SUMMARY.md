# Read-only repository status identifies filesystem aliases

PR #61's Windows and macOS failures both rejected valid worktrees whose filesystem spelling differed from Git's. Status now resolves both paths before exact registered-root comparison, preserves filesystem case sensitivity, and suppresses index refresh; focused regressions cover aliases and validation boundaries. Local verification is recorded in [details](DETAILS.md); required CI and merge confirmation remain pending.
