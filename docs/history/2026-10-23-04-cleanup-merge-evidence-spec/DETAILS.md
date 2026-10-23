# 2026-10-23 — Cleanup only with merge evidence: specified

## Incident

Branch `agent-instructions` had no commits of its own and was fast-forwarded to `origin/main` `166daa3`. At the next start, `cleanupBranches` (`app/src/branches.ts`) took it as merged: `worktreeState` (`app/src/worktrees.ts`) sets `merged` when the tip differs from the reflog creation commit and `ahead == 0`. The clean, idle worktree and branch were removed, and the next user turn made the branch again from `main`. No work was lost because the branch had none.

## Scope and outcome

User-agreed fix, specified only:

- [selfdev-010](../../features/self-development/SPEC.md#requirements): automatic removal only on a merged pull request confirmed for the current repository, base and branch/worktree binding; `request_merge` merges recorded, external merges verified; history checks alone never count; tip at the evidenced head, no uncommitted changes, no working agent; uncertain or unavailable evidence keeps the branch; manual Remove… stays separate; six acceptance cases. selfdev-001's safety-net text now points to it.
- [ADR 0021](../../architecture/decisions/0021-cleanup-needs-merge-evidence.md), indexed; [ADR 0014](../../architecture/decisions/0014-worktree-per-session.md) notes the amendment.
- [M1](../../MILESTONES.md#m1--the-workspace-develops-itself): new acceptance blocker line for [#76](https://github.com/MomSesImSpcl/ai-workspace/issues/76).
- [Progress](../../PROGRESS.md), [self-development summary](../../features/self-development/SUMMARY.md) status and [traceability](../../REQUIREMENTS_TRACEABILITY.md) row (specified, not built).
- GitHub issue #76 created with label `known-limit` (no existing open issue matched; closed #24 covered squash-merge detection, #69 the turn-start merged check).

## Verification and limits

- Checked the cause against `worktreeState`, `mergesIntoHead` and `cleanupBranches` in current code; no code changed.
- Docs checks: `git diff --check`, relative links of the changed files resolve, private-data look over the diff. App typecheck and tests not run (documentation only).
- Branch `agent-instructions`, based on `166daa3`; changes uncommitted and not pushed.

## Remaining work

Implement selfdev-010 with automated tests for its six acceptance cases, then verify once in the app; until then the current cleanup can still remove a branch only updated from `main`. M1 cannot be accepted before that.
