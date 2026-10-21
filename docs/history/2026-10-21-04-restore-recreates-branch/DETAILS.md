# 2026-10-21: unarchiving a chat of a removed branch makes the branch again

Scope: [selfdev-001](../../features/self-development/SPEC.md), proposed by the user and added to [M1](../../MILESTONES.md#m1--the-workspace-develops-itself) as required, since exit criterion 5 needs the requesting chat to continue after its branch was merged and removed.

## Outcome

- `app/src/branches.ts`: `replanBranch` marks a restored chat's removed worktree as not made yet; `app/src/ui.ts` calls it on unarchive. Its next turn makes the branch from the checkout's HEAD (`main`) with the usual notice and dependency install.
- `app/src/turn.ts`: a restored chat whose sibling already remade the folder joins it. `app/src/worktrees.ts`: a branch that still exists without its folder is checked out again instead of failing on `-b`.
- `app/src/ui.html`: a branch heading shows "removed" only when every chat under it is gone, and a read-only chat says to unarchive it to continue.

## Checks

- `npm run typecheck` clean, `npm test` 92/92; new test in `app/test/worktrees.test.ts`: two chats on one branch, merged and cleaned up; restoring one remakes the branch from main while the other stays archived; restoring the other joins it.
