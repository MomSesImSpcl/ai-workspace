# 2026-10-20: no CI run on `main` after a merge

Scope: CI ([working agreement](../../WORKING_AGREEMENT.md#ci)), selfdev-004; amends [ADR 0016](../../architecture/decisions/0016-main-ruleset.md) and [ADR 0017](../../architecture/decisions/0017-merge-through-workspace.md).

## Outcome

- Ruleset (set by the user): branches must be up to date with `main` before merging.
- `.github/workflows/ci.yml`: the `push: main` trigger is removed; runs happen only on pull requests.
- `app/src/merge.ts`: after Allow, `request_merge` fetches `main` and merges `origin/main` into the branch before pushing. On a conflict it runs `git merge --abort`, pushes nothing and tells the agent to resolve it.
- `app/test/merge.test.ts`: the expected git calls include the fetch and merge; a new case covers a conflict.

## Checks

`npm run typecheck` clean, `npm test` 75/75 passed, actionlint clean, private-data scan clean (local, Linux).

## Remaining

A pull request whose branch falls behind `main` must be updated (merge `main` in) before it can merge; that update runs CI once more on the pull request. The `request_merge` update path has not run in the app yet ([#34](https://github.com/MomSesImSpcl/ai-workspace/issues/34)).

Branch `claude/great-ride-93ynxs`; commit in the pull request.
