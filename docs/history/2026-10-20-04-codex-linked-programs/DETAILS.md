# Details: Codex runs linked programs in its sandbox (2026-10-20)

Scope: [#21](https://github.com/MomSesImSpcl/ai-workspace/issues/21), M1 (Codex completes the flow), [ADR 0015](../../architecture/decisions/0015-write-guard.md). Branch `claude/great-ride-93ynxs`, not merged.

## Cause

The user's Codex `PreToolUse` hook (`~/.codex/hooks.json`, `rtk hook codex`) rewrites `git ...` into `rtk git ...`. `rtk.exe` is found on the PATH in WinGet's `Links` folder, which only holds a link to the real program in WinGet's `Packages` folder. Inside Codex's Windows sandbox the call through the link fails ("No application is associated with the specified file"), while `git.exe` by its full path, a real file, works. That the link is the cause is inferred from these facts, not yet confirmed.

## Changes

- `sandboxPath` in `app/src/adapters/codex.ts`: for every PATH folder holding `.exe` links, the links' real folders are placed right before it (each folder once). `codex app-server` is started with that PATH (the key kept as spelled, `Path` on Windows), so the hook's commands, which inherit it, find the real `rtk.exe`. The user's setup is not changed.

## Verification

- New test in `app/test/worktrees.test.ts` (a folder with an `.exe` link, a plain folder, a missing one; skipped where links cannot be made). `npm run typecheck` is clean, and `npm test` passes 62/62 (Linux).
- To check on Windows: a Codex chat in a new app-project worktree runs `git status` and commits, with the `rtk` hook on.
