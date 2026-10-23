# ADR 0021: Branch cleanup needs merge evidence

## Status

accepted 2026-10-23, not implemented ([selfdev-010](../../features/self-development/SPEC.md#requirements), [#76](https://github.com/MomSesImSpcl/ai-workspace/issues/76), an M1 blocker). Amends the cleanup safety net of [ADR 0014](0014-worktree-per-session.md).

## Context

The start-up cleanup (ADR 0014, amended for squash merges in [#24](https://github.com/MomSesImSpcl/ai-workspace/issues/24)) infers a merge from Git history: the branch tip moved since its reflog creation commit, and either nothing of it is missing from `main` (`ahead == 0`) or a test merge into `main` changes nothing (`git merge-tree`). On 2026-10-23 a clean, idle branch with no commits of its own was fast-forwarded to `origin/main`; the next start removed it as merged, and the next turn made it again from `main`. Updating a branch from `main` meets the same conditions as a squash merge, so history alone cannot tell them apart.

## Decision

- Automatic removal needs positive evidence of an intentional merge: a pull request of the branch into `main` that GitHub reports as merged, confirmed for the app project's current repository and base and tied to the current branch/worktree binding (the workspace's record of that worktree and branch, with its creation commit and time). The branch name alone never ties evidence to a branch.
- `request_merge` records the merge with its binding once GitHub confirms it. A merge outside the workspace counts once the workspace verifies it the same way.
- Evidence of an earlier binding never carries over: a pull request merged before the binding was made, or whose head is not a commit of the current binding after its creation commit, does not count.
- Ancestry, matching trees, a `merge-tree` no-op or an update from `main` are not evidence.
- With evidence, removal still needs the tip to be the pull request's head, no uncommitted changes and no working agent.
- Missing, uncertain or unavailable evidence keeps the branch. Existing branches stay unless they get evidence. The user's Remove… in Settings is separate.

## Rejected alternatives

- Keep the history check and also require commits of the branch's own since creation: a branch with commits that the user later merged `main` into, or squash-merged elsewhere and then updated, is still ambiguous, and a reverted change can make a merge-tree no-op.
- Match merged pull requests by branch name only: a reused name inherits an old merge.
- No automatic cleanup at all: not chosen; the agreed fix keeps the safety net and makes it strict.

## Known limits

- Evidence needs gh to reach GitHub; offline or logged out, merged branches simply stay until a later start or manual removal (related: [#69](https://github.com/MomSesImSpcl/ai-workspace/issues/69)).
