# Details: Codex runs linked programs in its sandbox (2026-10-20)

Scope: [#21](https://github.com/MomSesImSpcl/ai-workspace/issues/21), M1 (Codex completes the flow), [ADR 0015](../../architecture/decisions/0015-write-guard.md). Branch `claude/great-ride-93ynxs`, not merged.

## Cause

The user's Codex `PreToolUse` hook (`~/.codex/hooks.json`, `rtk hook codex`) rewrites `git ...` into `rtk git ...`. `rtk.exe` is found on the PATH in WinGet's `Links` folder, which only holds a link to the real program in WinGet's `Packages` folder. Inside Codex's Windows sandbox the call through the link fails ("No application is associated with the specified file"), while `git.exe` by its full path, a real file, works. Confirmed by the user's Windows test (Codex 0.163.0, `codex exec -s workspace-write`): with the PATH fix, `rtk` resolved to the real file but failed with access denied. Its folder grants `CodexSandboxUsers` read and execute to new files, but `rtk.exe` predates that entry and only lists its owner, the administrators and SYSTEM; `git.exe` runs through the Users group. `icacls "<file>" /reset` (run by the user) lets the file take its folder's permissions; it may be needed again after a WinGet update.

## Changes

- `sandboxPath` in `app/src/adapters/codex.ts`: for every PATH folder holding `.exe` links, the links' real folders are placed right before it (each folder once). `codex app-server` is started with that PATH (the key kept as spelled, `Path` on Windows), so the hook's commands, which inherit it, find the real `rtk.exe`. The user's setup is not changed.

- `app/src/sandbox-check.ts` (new, agreed with the user): on Windows, when Codex starts with a sandbox and the user's hooks on, the programs named in the user's Codex `hooks.json` (each command's first word, also PowerShell's `& 'path'`, and `.exe` paths among the arguments, such as caveman-proxy's `--node`) are found with Codex's PATH and checked. A link is reported with its target; a file whose access list gives no read and execute to `CodexSandboxUsers`, Users, Authenticated Users or Everyone (by SID; a deny wins) is reported with `icacls "<file>" /reset`. The decision never reads error text, which depends on the Windows language: one PowerShell `Get-Acl` call returns SIDs and rights as numbers. A file whose list cannot be read is not reported. The notices show once per Codex start, at its first turn. No check on other systems. That the sandbox users are in Users is shown by `git.exe`; Authenticated Users and Everyone are assumed. Programs are not run to test them, since a user's program may have side effects.

## Verification

- Tests: `sandboxPath` in `app/test/worktrees.test.ts`; `app/test/sandbox-check.test.ts` covers the hooks parsing (the user's hook shapes), the ACL decision (owner-only as on `rtk.exe`, `CodexSandboxUsers` after the reset, Users in German, generic rights, read only, deny), links with their targets, unreadable lists, the notice text and no check outside Windows; a Windows-only test reads a real file's list through PowerShell (CI). `npm run typecheck` is clean, and `npm test` passes 67/67 (Linux).
- To check on Windows (user): the notice appears in a Codex worktree chat with the `rtk` hook on; after `icacls ... /reset`, Codex runs `git status` and commits.
