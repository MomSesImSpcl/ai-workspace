# ADR 0019 — A session's worktree binding is checked against git before work and publication; a stale chat continues only in a new chat the user confirms

Status: accepted (2026-10-22, agreed fix scope for [#62](https://github.com/MomSesImSpcl/ai-workspace/issues/62)), implemented 2026-10-22 for [selfdev-008](../../features/self-development/SPEC.md#requirements). Amends [ADR 0014](0014-worktree-per-session.md) (worktree per chat) and [ADR 0017](0017-merge-through-workspace.md) (`request_merge`).

## Context

A chat stores its worktree folder and branch when it is created (ADR 0014); `request_merge` publishes that stored branch (ADR 0017). In #62 a chat went on after its pull request #61 merged; its agent switched the same worktree to a newly prepared branch, and `request_merge`, still bound to the merged branch, refused with "already merged". Nothing noticed the mismatch before the work was done, and the chat had no supported way on. Trusting Git HEAD instead of the stored branch would let any checkout publish under the chat's approval, and changing a stored binding in place would hide which branch the earlier work and approvals belonged to.

## Decision

- **One shared check** (`bindingProblem` in `app/src/binding.ts`) compares the stored binding with git: the project is still the app project; the folder is one the workspace keeps for it; a made worktree still exists; git lists the folder as a worktree of the project's repository; it has the stored branch checked out (not another branch, not a detached HEAD, with a note when the stored branch was deleted); and, for a branch that was pushed, no merged pull request has its head commit in the branch's history (`mergedPr` in `app/src/merge.ts`). A merged pull request of an earlier branch with the same name (a restored chat's branch made again from main) does not count. The answer names the session, project, folder, stored and actual branch and HEAD, the uncommitted files and unpushed commits the folder keeps, and the way on.
- **Where it runs:** at every turn of a worktree session, chats and tasks alike, before the agent starts (`workRoot` in `app/src/turn.ts`); a problem ends the turn with an error marked as a binding error, and no agent runs. `request_merge` runs it before the approval card and again after Allow, right before git merges main into the checked-out branch; the merged-pull-request guard also runs at both points. Nothing is switched, reset, deleted or moved.
- **Explicit continuation** (`continueSession` in `app/src/binding.ts`, `POST /api/sessions/<id>/continue`, "Continue in a new chat" in the chat): only after the user picks a destination and confirms a dialog; the API refuses without `confirmed: true`. The destination is either a new branch, planned like any new worktree but made at its first message from `origin/main` fetched just before (without tracking main), or an existing workspace worktree from the same list a new chat offers, which must pass the check first. The new chat copies the old chat's log, role, agent, model, effort and permission settings, records `continuedFrom`, and its agent gets the conversation as text with the next message. Both chats get a notice. The old chat keeps its binding and log; its worktree, commits and uncommitted changes stay where they are. A working chat, a task, or a chat without a worktree cannot be continued this way.
- **No new authority:** the new chat gets the same permissions the old one had; publication still needs `request_merge`'s card, the reported checks, the up-to-date merge and the merged-PR guard (ADR 0016, 0017).

## Rejected alternatives

- Publishing Git HEAD instead of the stored branch, or adding a branch argument to `request_merge`: any branch checked out in the folder would be published under the chat's approval.
- Rebinding the old chat in place: the chat's earlier turns and approvals would appear to belong to another branch, and the stale binding would be lost as evidence.
- Moving uncommitted changes to the new branch automatically: work could land on the wrong branch without the user seeing it.

## Known limits

- The turn-start merged check asks gh only for branches with an upstream or a remote-tracking ref, and is skipped when gh cannot answer (offline, not logged in); `request_merge` still refuses a merged branch, since it asks gh itself. Tracked in [#69](https://github.com/MomSesImSpcl/ai-workspace/issues/69).
- Verified with automated tests (real git, a fake gh), not yet end to end in the app with real agents and a real pull request; until then #62 and the M1 acceptance gate stay open.
