# 2026-10-20: branch cleanup takes squash-merged branches (#24)

Scope: [selfdev-001](../../features/self-development/SPEC.md#requirements) cleanup safety net, [ADR 0014](../../architecture/decisions/0014-worktree-per-session.md) (amended), [#24](https://github.com/MomSesImSpcl/ai-workspace/issues/24).

## Outcome

- `worktreeState` in `app/src/worktrees.ts`: a branch with commits of its own is merged when all of them are in HEAD or when `mergesIntoHead` finds that merging it would leave HEAD's files unchanged (`git merge-tree --write-tree`, git 2.38 or newer). A conflict or an older git counts as not merged. `deleteWorktree` deletes the branch with `-D`, since git's own check misses squash merges; callers decide by `worktreeState`.
- Remove… in Settings no longer warns "unmerged commits" for a squash-merged branch.
- `app/src/cli.ts`: the cleanup runs at start only (user, 2026-10-20). Merges reach the checkout through Update and restart or a pull and ⟳, which ends in a start. Settings text updated.
- `npmCommand` in `app/src/worktrees.ts` takes the arguments and, on Windows, returns one command string for the shell (Node's `DEP0190`, seen in `last-good.log`); used by `installDependencies` and `recordLastGood`.

## Checks

`npm run typecheck` clean, `npm test` 82/82. New tests in `app/test/worktrees.test.ts`: a branch squash-merged with two commits is removed and its chat archived; one with a commit after the merge and one reverted on `main` stay; Remove… still warns for the one with a later commit; `npmCommand` on Windows and elsewhere. Not run in the app.
