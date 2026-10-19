# Details: write guard for the running instance (2026-10-19)

Scope: [selfdev-002](../../features/self-development/SPEC.md#requirements), [ADR 0015](../../architecture/decisions/0015-write-guard.md) (amends ADR 0004). Branch `claude/great-ride-93ynxs`; work started in a local session that hit its usage limit, was pushed by the user as `claude/selfdev-002-wip` (624fba5) and finished in a cloud session.

## Changes

- `app/src/worktrees.ts`: `guardFor` (guarded: `appRepo()` and `home()`; allowed: the session's folder), `guardedPath` (deepest folder decides, tie guarded, case-insensitive, Git Bash `/c/...`), `guardedTree` (folder access), `guardedCommand` (paths named in a shell command, `~`/`$HOME`/`%USERPROFILE%` expanded, quoted code searched by spelling).
- `app/src/guard-hook.ts` (new): Claude Code `PreToolUse` hook; denies with a reason that names the session folder and the Read tool.
- `app/src/adapters/claude-code.ts`: the hook on `Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell` in every run's `--settings`.
- `app/src/adapters/codex.ts`: `guardedRequest`; guarded command, file-change and permission requests are declined with a notice, no card. Worktree sessions with full access run in `workspace-write` with network and `on-request`.
- Tests: `app/test/worktrees.test.ts` (guard paths and commands, Codex requests, the hook as a process); `app/test/tasks.test.ts` (every run gets the hook; a plain chat's `--settings` holds only the hook).

## Verification

- `npm run typecheck` clean; `npm test` 58/58 (Linux, Node 22).
- Real Claude Code 2.1.303 (haiku) with only the guard hook, in `bypassPermissions`, on Linux: Write and `Bash echo > file` into the guarded folder were denied with the hook's reason and left no file; a Write into the allowed folder succeeded.
- Earlier, in the local session (Windows): Codex's Windows sandbox blocked writes outside the session folder and writes into the checkout's `.git` folder from a worktree, so worktree commits need approval.
- Not run: the app on Windows with real Claude Code and Codex sessions in an app-project worktree.

## Follow-ups the same day (user)

- Commands that only read pass (`readOnlyCommand`).
- Every blocked write is a chat notice with the command or file and, for a command, where the read list is (`guardNotice`, `GUARD_MARK`; Claude Code's taken from the hook reason in the tool result, checked against a real stream line).
- Codex: worktree sessions get `commitRoots` as writable sandbox folders; full access becomes approval `never`, so writes beyond the sandbox fail instead of asking. Not run with the real Codex: [#20](https://github.com/MomSesImSpcl/ai-workspace/issues/20).
- Global chats stay read-only in the checkout: the app is developed through worktrees only.
- Tests 59/59.

## Limits

- [#18](https://github.com/MomSesImSpcl/ai-workspace/issues/18): paths computed at run time are not seen by the shell check; Claude Code has no OS sandbox on Windows.
- Commands that only read may name or run in a guarded folder (user, 2026-10-19; `readOnlyCommand`, tests for allowed and denied spellings).
- About 105 ms per guarded Claude Code tool call for the hook's Node process (measured on Linux, Node 22; Windows not measured).
- If the workspace folder is the app checkout itself, global chats cannot write anywhere in it (tie guarded).
