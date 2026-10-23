# ADR 0020: A branch's test instance

## Status

accepted 2026-10-23, implemented 2026-10-23 ([selfdev-009](../../features/self-development/SPEC.md#requirements)).

## Context

The user wants to try a branch's code while working in the main instance. Electron allows one instance per data folder, and storage holds the user's real projects, chats and tasks.

## Decision

- The main instance starts the test instance from the branch heading's context menu. It runs the worktree's `app/` with the worktree's Electron or, since worktrees skip Electron's binary (#26), the running app's.
- It gets its own storage (`<storage>/test/<branch>`, through `AI_WORKSPACE_HOME`) and its own Electron data folder (`--user-data-dir`), which also gives it its own single-instance lock. Opening it again finds that lock and brings the open window to the front.
- The main instance copies `roles.json`, `agent-setup.json`, `settings.json` and `workspace.json` into it at every start; nothing flows back. Projects, chats, tasks and the audit log stay out.
- `AI_WORKSPACE_TEST_BRANCH` marks it: title `Test Branch - <branch>`, no update buttons, no last working version, and no test instance of its own.
- Its storage folder is removed with the branch's worktree.

## Rejected alternatives

- Sharing the main storage: two instances writing the same session files can corrupt them.
- A separate Codex or Claude Code home for it: agents use the computer's logins, as in the main instance (user, 2026-10-23).

## Known limits

- The worktree's code decides what the instance does, so a branch made before this decision shows neither the title nor the hidden buttons.
- The running app's Electron must match what the branch's code expects.
