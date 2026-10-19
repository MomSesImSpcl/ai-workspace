# ADR 0015 — A fixed write guard keeps agents out of the running app's checkout and storage

Status: accepted (2026-10-19), implemented 2026-10-19 for selfdev-002. Amends [ADR 0004](0004-agent-native-permissions.md)'s "the workspace adds no permission layer of its own" with one fixed rule; everything else in ADR 0004 still holds.

## Context

[selfdev-002](../../features/self-development/SPEC.md) requires that agent edits, installs and builds never change the running instance's files, dependencies or storage, enforced by checks rather than model instructions. [ADR 0014](0014-worktree-per-session.md) puts each app-project session in its own worktree in workspace storage, but the agents can still write anywhere their own permissions allow, and bypass modes allow everything. ADR 0004 leaves permissions to the agents, so nothing stopped a write into the live checkout or storage.

## Decision

- **One fixed rule, not a permission layer:** for every session and task, the running app's checkout (`appRepo()`) and the workspace's storage (`home()`) are guarded; the session's own folder stays writable, also inside them, as a worktree in storage is. The deepest matching folder decides, and a tie is guarded. It has no settings and cannot be turned off per session. Code: `guardFor`, `guardedPath`, `guardedTree`, `guardedCommand` in `app/src/worktrees.ts`.
- **Claude Code:** a `PreToolUse` hook (`app/src/guard-hook.ts`) on `Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell`, added to every run's `--settings`, denies a matching call with a reason that points to the session folder and the Read tool. Hook decisions apply in every permission mode, `bypassPermissions` included (checked with a real run). Claude Code adds hooks from every settings source, so the user's own hooks stay.
- **Codex:** approval requests (command, file change, extra file access) that would write into a guarded folder are declined without a card, with a notice in the chat. Worktree sessions set to full access run in Codex's `workspace-write` sandbox with network on and approval `on-request` instead, so the OS sandbox is the hard limit and anything beyond it asks.
- **Shell commands are checked by the paths they name** (quotes, `~`, `$HOME`, `%USERPROFILE%`, `..` and Git Bash's `/c/...` spelling resolved, also inside quoted code). Any command naming a guarded folder is denied, read-only ones too.

## Rejected alternatives

- Instructions to the agent only: selfdev-002 forbids relying on them.
- A workspace permission layer with per-project rules: ADR 0004's reason still holds; one fixed rule covers the need.
- Running Claude Code in an OS sandbox on Windows: Claude Code has none there.

## Known limits

- A path computed at run time (variables, scripts, a program that writes elsewhere) is not seen by the shell check; for Codex the OS sandbox still catches it, for Claude Code on Windows nothing does. Tracked in [#18](https://github.com/MomSesImSpcl/ai-workspace/issues/18).
- In Codex's Windows sandbox a commit in a worktree writes into the checkout's `.git` folder, outside the sandbox, so each commit asks for approval.
- Each guarded Claude Code tool call starts a Node process for the hook (roughly 100–150 ms).
