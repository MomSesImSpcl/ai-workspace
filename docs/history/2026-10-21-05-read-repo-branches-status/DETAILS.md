# 2026-10-21: `read_repo` branches and status

Scope: [selfdev-004](../../features/self-development/SPEC.md), extending the read-only tool from [#31](https://github.com/MomSesImSpcl/ai-workspace/issues/31).

## Outcome

- `app/src/repo-read.ts`: `branches` runs `git for-each-ref` over `refs/heads` and `refs/remotes` (skipping symbolic refs such as `origin/HEAD`), joins each local branch with its worktree from `git worktree list --porcelain`, and counts ahead/behind with `git rev-list --left-right --count main...<ref>` (`origin/main` when no local `main`). `status` runs `git status --short` in the checkout, or in `path`.
- Boundary: `path` for `status` must equal a worktree git lists for the project, otherwise it is refused (`Not a worktree of this project`); no other directory is read. Only read commands run, and the existing ref check and 30,000-character cap apply.
- `app/src/approval-server.ts`: tool description and `action` enum list the new actions.

## Checks

- `npm run typecheck` clean, `npm test` all pass; new test in `app/test/repo-read.test.ts`: branches with a worktree, a behind branch, a remote branch and `origin/HEAD`; status of the checkout and of a worktree; paths outside the project's worktrees refused.
