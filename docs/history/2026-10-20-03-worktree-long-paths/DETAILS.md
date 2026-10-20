# Details: worktree creation on long paths (2026-10-20)

Scope: [#22](https://github.com/MomSesImSpcl/ai-workspace/issues/22), selfdev-001 ([ADR 0014](../../architecture/decisions/0014-worktree-per-session.md)). Branch `claude/great-ride-93ynxs`, not merged.

## Changes

- `addWorktree` in `app/src/worktrees.ts`: on failure it prunes the worktree list and deletes the new branch, if it did not exist before. A path-length failure (`'$GIT_DIR' too big`, `Invalid path`, too long, `ENAMETOOLONG`) becomes a message naming the path, its length, and what to change (a shorter branch name or storage folder). It also passes `core.longpaths=true` to `git worktree add`, so Windows Git can check out files past 260 characters where the system allows it.
- Same commit: ADR 0015, the spec, traceability and the integration matrix now record the Windows test of #20 instead of "not yet run".

## Verification

- Reproduced on Linux: a worktree folder about 12 characters under the 4096 limit gives `fatal: '$GIT_DIR' too big` (the user's Windows error) and leaves the branch behind.
- New test in `app/test/worktrees.test.ts` builds that path per system (Windows 260, macOS 1024, Linux 4096). It fails without the branch cleanup and passes with it. `npm run typecheck` is clean, and `npm test` passes 61/61 (Linux).
- Not run: the app on the user's Windows storage path.
