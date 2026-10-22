# 2026-10-22: orchestrator reads storage; guard readers

Scope: [orchestrator-006](../../features/ai-orchestrator/SPEC.md) (the orchestrator answers questions itself) and the write guard ([ADR 0015](../../architecture/decisions/0015-write-guard.md), selfdev-002). Decided by the user.

## Cause

A Codex orchestrator had no way to read files: its setup items all default to off, including `feature:shell_tool`, and Codex has no other file-reading tool. To look up session history, it started a task. The task's commands named workspace storage or the checkout, and the guard blocked them:
- the first used `$(date …)` (command substitution), `for` and `sed`;
- the second used `awk` and `git reflog`;
- the third used `sort` and `uniq`.

## Outcome

- `app/src/setup.ts`: `feature:shell_tool` defaults to on for the orchestrator as well (a state the user set still wins). The Codex orchestrator runs with `sandbox: read-only` and `approvalPolicy: never`, so its commands can read but cannot write.
- `app/src/adapters/claude-code.ts`: the Claude Code orchestrator gets `--add-dir <storage>`, so Read, Glob and Grep reach storage without an approval card. It has no tool that writes.
- `app/src/sessions.ts`: the orchestrator note says that its commands may only read, and where storage keeps chat and task histories and the audit log.
- `app/src/worktrees.ts` (`readOnlyCommand`): new readers `sort` (not `-o`), `uniq` (at most one file, since `uniq IN OUT` writes), `cut`, `tr`, `nl`, `date` (not `-s`/`--set`), `read`, and `git reflog` (listing or `show`, not `expire` or `delete`). Loop and branch words (`for … in`, `do`, `done`, `while`, `if`, `then`, `fi`, …) are skipped, and the command after them is checked on its own.
- Still blocked: `sed` and `awk` (their scripts can write files and run commands), `$(...)` and backticks, and any redirect into a file.

## Checks

- `npm run typecheck` clean, `npm test` 99/99. The guard test now covers the new readers in a pipeline, `git reflog show`, a `for` loop and `while read`. It also covers what stays blocked: `sort -o`, `uniq IN OUT`, `reflog expire/delete`, `date -s`, `sed -i`, `awk` writing to a file, a loop that runs `rm`, and a loop over `$(ls)`.
- The orchestrator test checks `--add-dir <storage>` and the storage sentence in the note. The setup test checks that Codex's shell is on for the orchestrator.
- Not yet run in the app with real agents.

## Limits

An input redirect (`done < file`) is still treated as a command and is blocked; piping the file in with `cat file |` passes.
