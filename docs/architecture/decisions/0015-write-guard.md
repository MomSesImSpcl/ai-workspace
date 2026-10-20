# ADR 0015 — A fixed write guard keeps agents out of the running app's checkout and storage

Status: accepted (2026-10-19), implemented 2026-10-19 for selfdev-002. Amends [ADR 0004](0004-agent-native-permissions.md)'s "the workspace adds no permission layer of its own" with one fixed rule; everything else in ADR 0004 still holds.

## Context

[selfdev-002](../../features/self-development/SPEC.md) requires that agent edits, installs and builds never change the running instance's files, dependencies or storage, enforced by checks rather than model instructions. [ADR 0014](0014-worktree-per-session.md) puts each app-project session in its own worktree in workspace storage, but the agents can still write anywhere their own permissions allow, and bypass modes allow everything. ADR 0004 leaves permissions to the agents, so nothing stopped a write into the live checkout or storage.

## Decision

- **One fixed rule, not a permission layer:** for every session and task, the running app's checkout (`appRepo()`) and the workspace's storage (`home()`) are guarded; the session's own folder stays writable, also inside them, as a worktree in storage is. The deepest matching folder decides, and a tie is guarded. It has no settings and cannot be turned off per session. Code: `guardFor`, `guardedPath`, `guardedTree`, `guardedCommand` in `app/src/worktrees.ts`.
- **Claude Code:** a `PreToolUse` hook on `Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell`, added to every run's `--settings`, denies a matching call with a reason that points to the session folder and the Read tool. Hook decisions apply in every permission mode, `bypassPermissions` included (checked with a real run). Claude Code adds hooks from every settings source, so the user's own hooks stay. The hook is an `http` hook (amended 2026-10-20, user): the process that runs the agent serves the guard on `127.0.0.1` (`app/src/guard.ts`), and each run has its own token, which also selects its folders. So no process starts per tool call. An unreachable hook server lets the call through (checked with a real run), so the server runs in the process that reads the agent's output and ends with it, and a run's token ends with its agent process. If the server cannot start, the command hook `app/src/guard-hook.ts` takes over.
- **Codex:** approval requests (command, file change, extra file access) that would write into a guarded folder are declined without a card. Worktree sessions get the parts of the checkout's `.git` that a commit writes to as writable sandbox folders (`commitRoots`: the worktree's git folder, `objects`, `refs/heads`, `logs/refs/heads`; not `hooks` or `config`). Worktree sessions set to full access run in `workspace-write` with network on and approval `never`, so the OS sandbox is the hard limit and anything beyond it fails instead of asking (amended 2026-10-19, user; not yet run with the real Codex: [#20](https://github.com/MomSesImSpcl/ai-workspace/issues/20)).
- **Shown in the chat:** every blocked write becomes a notice naming the command or file (`guardNotice`); for a command it says how to add a reading program to the read list. Claude Code's notice is taken from the hook's deny reason in the tool result.
- **Shell commands are checked by the paths they name** (quotes, `~`, `$HOME`, `%USERPROFILE%`, `..` and Git Bash's `/c/...` spelling resolved, also inside quoted code). A command naming a guarded folder or run in one is denied unless every part of it only reads (amended 2026-10-19, user): a short list of reading programs (`ls`, `cat`, `grep`, `find` without actions, PowerShell's `Get-Content` and similar) and git's reading subcommands (`log`, `show`, `diff`, `status`, listing `branch`), with no output written to a file and no command substitution (`readOnlyCommand`).

## Rejected alternatives

- Instructions to the agent only: selfdev-002 forbids relying on them.
- A workspace permission layer with per-project rules: ADR 0004's reason still holds; one fixed rule covers the need.
- Running Claude Code in an OS sandbox on Windows: Claude Code has none there.

## Known limits

- A path computed at run time (variables, scripts, a program that writes elsewhere) is not seen by the shell check; for Codex the OS sandbox still catches it, for Claude Code on Windows nothing does. Tracked in [#18](https://github.com/MomSesImSpcl/ai-workspace/issues/18).
- Codex may still refuse the `.git` writable folders, since it protects `.git` in its sandbox; then worktree commits fail ([#20](https://github.com/MomSesImSpcl/ai-workspace/issues/20)). If they work, the agent can move any branch pointer, `main` included (working files stay untouched; the reflog recovers it).
- Global chats start in the workspace folder, which is the app checkout on the user's machine, so they only read there; the app is developed through worktrees only (user, 2026-10-19).
- Each guarded Claude Code tool call costs about 3 ms with the HTTP hook (measured on Linux, Node 22); the command-hook fallback costs about 105 ms.
- `git status` in the checkout may refresh its index file; that write is accepted as harmless.
