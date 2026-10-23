# ADR 0014 — A worktree per session, in workspace storage, shared by the chat's tasks

Status: accepted (2026-10-19, chosen by the user); implemented 2026-10-19 for selfdev-001; amended the same day: the user picks the worktree for every new chat, and the per-project switch became the app project.

## Context

Agents developing the workspace must never edit the checkout the running app is started from ([selfdev-001, selfdev-002](../../features/self-development/SPEC.md)). The spec left open where the worktrees live, which projects get them and how a chat's tasks relate to them.

## Decision

- **The app project (amended 2026-10-19, user):** started from a git checkout, the app adds that repository as a project at every start unless a project already has its folder (`addAppProject` in `app/src/worktrees.ts`). Only this project works in worktrees; it is listed first with a line below it and has no menu, so it can be neither removed nor archived. A packaged release runs from no checkout, so it has no app project and no worktrees. This replaced a per-project "New worktree per session" switch, which also let other projects work in worktrees; selfdev-007 is deferred.
- **Location:** `<workspace storage>/worktrees/<project>/<session>`, outside the repository, on a new branch `aiws/<session id>` from the project checkout's HEAD. The repository's own tools (TypeScript, test globs) never see the worktrees, and a write rule for the live checkout (selfdev-002) does not cover them.
- **Tasks share the chat's worktree:** a task started from a chat, and its subtasks, run in the chat's worktree and branch, so one change is reviewed and merged once. A task started without a chat gets its own.
- The worktree is planned when the session is created and made at its first turn; a worktree gone after that stops the session with an error instead of falling back to the project folder.
- **Chosen per chat (amended 2026-10-19, user):** a new chat in such a project starts only after the user picks "New worktree" or an existing workspace-made worktree of the project (branch and the title of the session that made it), with no preselection. Continuing one lets work go on from an empty chat, for example after a session's prompt cache went cold. Tasks and command-line sessions keep getting a new one or their chat's.
- **Named worktrees (amended 2026-10-19, user):** a new worktree is named by the user in the Send row (the name is its branch and folder), instead of `aiws/<session id>`; tasks and command-line sessions keep `aiws/<session id>`. The sessions list groups the app project's chats by worktree.

- **Dependencies (amended 2026-10-20, user):** a new worktree gets `npm ci` from the app before its first turn ([#26](https://github.com/MomSesImSpcl/ai-workspace/issues/26)); linking `node_modules` from the checkout was rejected, since a dependency change in the worktree would then change the running app (selfdev-002).

## Alternatives

- Inside the repository (`<repo>/.worktrees/`, as some agent apps do): easier to find, but needs an ignore entry and is covered by any path rule for the checkout.
- A worktree per task: full isolation, but every task needs its own merge, and a follow-up task does not see an earlier task's unmerged change.

## Consequences

- Tasks of one chat that run at the same time can edit the same files; the orchestrator sends follow-ups to the running task instead (orchestrator-006).
- Syncing with `main`, merging and removing merged worktrees stay the agent's work ([vcs-011](../../features/version-control/SPEC.md)).
- **Cleanup safety net (amended 2026-10-19, user):** the workspace removes merged branches (commits of their own, all in `main`; a fresh branch never counts) without uncommitted changes or a running agent, at start. Amended 2026-10-20 ([#24](https://github.com/MomSesImSpcl/ai-workspace/issues/24), user): a squash-merged branch counts as merged when merging it into `main` would change nothing (`git merge-tree`), since `main` takes only squash merges (ADR 0016); the daily run is gone, because merges reach the checkout through Update and restart (ADR 0018), which ends in a start. Chats of a removed branch are archived and read only. Unmerged branches are only removed by the user in Settings → General, which lists every branch with its state and size. Amended 2026-10-23 by [ADR 0021](0021-cleanup-needs-merge-evidence.md) (not implemented yet, [#76](https://github.com/MomSesImSpcl/ai-workspace/issues/76)): Git history alone no longer counts as merged; the cleanup needs a merged pull request confirmed for the current binding.
- Two chats continuing the same worktree at the same time can overwrite each other's edits; that is the user's choice, as with two terminals.
- **Amended 2026-10-22 by [ADR 0019](0019-binding-check-and-continuation.md) ([#62](https://github.com/MomSesImSpcl/ai-workspace/issues/62)):** every turn checks the stored binding against git first (a gone worktree is one of those checks); a chat whose binding went stale continues only in a new chat the user confirms, whose new branch starts from freshly fetched `origin/main`.
