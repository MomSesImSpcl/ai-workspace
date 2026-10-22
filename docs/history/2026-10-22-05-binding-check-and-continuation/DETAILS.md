# 2026-10-22: Binding check before work and publication, and explicit continuation

Scope: the agreed fix for [#62](https://github.com/MomSesImSpcl/ai-workspace/issues/62), based on the read-only investigation of task 857e4687 (timeline of 2026-10-21: PR #61 merged as `45f4006` at 17:26 CEST, the same worktree was then switched to a prepared branch, and `request_merge` stayed bound to `merge-conflict-test`). New requirement [selfdev-008](../../features/self-development/SPEC.md#requirements), [ADR 0019](../../architecture/decisions/0019-binding-check-and-continuation.md); amends ADR 0014 and ADR 0017. Branch `worktree-binding-fix`, started from freshly fetched `origin/main` (`3384912`).

## Outcome

- `app/src/binding.ts` (new): `bindingProblem` checks a stored binding against git: app project, the folder is one the workspace keeps for that project, the worktree exists, git lists it for the project's repository, the stored branch is checked out, and, for a pushed branch, no merged pull request has its head in the branch. Its message names the session, project, folder, stored and actual branch with HEAD, the uncommitted files and unpushed commits left untouched, and the way on. `continueSession` makes the new chat: a copied log, the same role, agent, model, effort and permission settings, `continuedFrom`, and notices in both chats. It refuses tasks, chats without a worktree and working chats.
- `app/src/turn.ts`: `workRoot` runs the check before every turn of chats and tasks. A problem throws `BindingError`, and the turn ends with an error marked `binding` before any agent starts.
- `app/src/merge.ts`: pull requests are listed per head branch (`gh pr list --head … --state all`). `mergedPr` counts a merged one only when its head commit is in the local branch, so a branch made again under the same name, as a restored chat's is, can open a new pull request. `requestMerge` takes the binding check and runs it before the card and again after Allow, before any git command, together with the merged-PR guard. The merge note tells agents to keep the worktree on its branch.
- `app/src/approval-server.ts`: `request_merge` passes the session's binding check.
- `app/src/worktrees.ts`: `checkedOut`, `ownWorktreePath`, and a `base` for continued chats. `addWorktree` fetches `origin main` first and makes the branch from `origin/main` with `--no-track`.
- `app/src/ui.ts`, `app/src/ui.html`: `POST /api/sessions/<id>/continue` needs `confirmed: true`. The chat shows "Continue in a new chat" (a new branch from origin/main, or an existing branch) under a turn stopped by the check, or under a chat whose branch was removed. A dialog says what stays where before anything is made.

## Checks

- `npm run typecheck` clean; `npm test` 105/105 on Windows (Node 24, git 2.47). Before the change, the same suite on fresh `origin/main` passed 99/99.
- `app/test/binding.test.ts` (real git with a local bare origin, fake gh):
  - **Merged PR, continuation, new PR:** the merged original PR stops the next turn and `request_merge` with no card. A confirmed continuation makes a new branch from freshly fetched origin/main while the running checkout still lags, and gives the agent the earlier conversation. `request_merge` then opens exactly one new pull request for the new branch. The stale chat still cannot publish, and its binding and uncommitted file stay unchanged.
  - **Branch switched in the worktree (the #62 replay):** the chat, its task and its `request_merge` are blocked, and nothing is pushed. Taken names, foreign folders and continuing a task are refused. Continuing on the prepared branch is explicit and works, while the old chat stays stale. A detached HEAD and a deleted stored branch are named.
  - **Missing or foreign bindings:** a missing worktree, a plain folder in its place, a folder outside workspace storage, a non-app project and a removed project are each named. A planned worktree passes.
  - **Cleanup and restore:** the start-up cleanup keeps a stale chat's unmerged prepared work. A restored chat of a merged and cleaned-up branch, made again from main, is not mistaken for the merged one.
  - **Active chat and confirmation:** continuation is refused while the chat works. The API refuses an unconfirmed continuation, and the old worktree is not switched back.
- `app/test/merge.test.ts`:
  - a binding that is stale before the card, or turns stale while it waits, runs nothing;
  - a pull request merged while the card waits pushes nothing;
  - a merged pull request of an earlier same-name branch leads to a new pull request.
- Mutation check: with the turn-start check disabled, 4 of the 5 new binding tests fail.
- The restart case is covered only in that the check reads stored state and git at every turn, also in a new host. No real app restart was run.

## Not verified / limits

- Not run in the app with real Claude Code or Codex, and no real pull request was opened (on purpose: no test pull requests). The UI control and dialog were not opened in a browser or Electron; their script was only syntax-checked. #62 stays open and the M1 gate stays closed until this is verified in the app.
- The turn-start merged check covers only pushed branches with a reachable gh ([#69](https://github.com/MomSesImSpcl/ai-workspace/issues/69)). `request_merge` always asks gh.
- Historical sessions and bindings were not changed.
