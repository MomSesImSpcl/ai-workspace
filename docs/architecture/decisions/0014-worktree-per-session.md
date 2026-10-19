# ADR 0014 — A worktree per session, in workspace storage, shared by the chat's tasks

Status: accepted (2026-10-19, chosen by the user); implemented 2026-10-19 for selfdev-001; amended the same day: the user picks the worktree for every new chat.

## Context

Agents developing the workspace must never edit the checkout the running app is started from ([selfdev-001, selfdev-002](../../features/self-development/SPEC.md)). The spec left open where the worktrees live, which projects get them and how a chat's tasks relate to them.

## Decision

- **Per-project switch:** a project's "New worktree per session" switch decides; unset, it is on only for the repository the running app is started from (`worktreesOn` in `app/src/worktrees.ts`). Other projects can turn it on (selfdev-007).
- **Location:** `<workspace storage>/worktrees/<project>/<session>`, outside the repository, on a new branch `aiws/<session id>` from the project checkout's HEAD. The repository's own tools (TypeScript, test globs) never see the worktrees, and a write rule for the live checkout (selfdev-002) does not cover them.
- **Tasks share the chat's worktree:** a task started from a chat, and its subtasks, run in the chat's worktree and branch, so one change is reviewed and merged once. A task started without a chat gets its own.
- The worktree is planned when the session is created and made at its first turn; a worktree gone after that stops the session with an error instead of falling back to the project folder.
- **Chosen per chat (amended 2026-10-19, user):** a new chat in such a project starts only after the user picks "New worktree" or an existing workspace-made worktree of the project (branch and the title of the session that made it), with no preselection. Continuing one lets work go on from an empty chat, for example after a session's prompt cache went cold. Tasks and command-line sessions keep getting a new one or their chat's.
- **Git only:** the switch is unavailable, and off, for a folder that is not in a git repository.

## Alternatives

- Inside the repository (`<repo>/.worktrees/`, as some agent apps do): easier to find, but needs an ignore entry and is covered by any path rule for the checkout.
- A worktree per task: full isolation, but every task needs its own merge, and a follow-up task does not see an earlier task's unmerged change.

## Consequences

- Tasks of one chat that run at the same time can edit the same files; the orchestrator sends follow-ups to the running task instead (orchestrator-006).
- Syncing with `main`, merging and removing merged worktrees stay the agent's work ([vcs-011](../../features/version-control/SPEC.md)).
- Changing the switch affects only sessions created afterwards.
- Two chats continuing the same worktree at the same time can overwrite each other's edits; that is the user's choice, as with two terminals.
