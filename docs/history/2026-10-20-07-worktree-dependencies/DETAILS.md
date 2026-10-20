# Details: dependencies in a new worktree (2026-10-20)

Scope: [#26](https://github.com/MomSesImSpcl/ai-workspace/issues/26), selfdev-001/003, M1 exit criterion 3, [ADR 0014](../../architecture/decisions/0014-worktree-per-session.md) (amended). Branch `claude/great-ride-93ynxs`, not merged.

## Changes

- `installDependencies` in `app/src/worktrees.ts`: `npm ci --no-audit --no-fund` in the worktree's root and `app/` where a `package-lock.json` is, with `ELECTRON_SKIP_BINARY_DOWNLOAD=1` as in CI (nothing starts the desktop app from a worktree yet). npm runs through a shell on Windows (a `.cmd` script); `AI_WORKSPACE_NPM` replaces it for tests. A notice before and after; a failure gives the exit code and npm's last five lines and the session goes on.
- `workRoot` in `app/src/turn.ts` is async and installs right after making the worktree, so the first turn waits for it.

## Verification

- New test in `app/test/worktrees.test.ts` with a fake npm: it runs in the new worktree's `app/` with the expected arguments and Electron skipped, the notices appear, the agent starts after the install; a failing npm gives the failure notice and the session still starts. `npm run typecheck` is clean, and `npm test` passes 70/70 (Linux).
- Real `npm ci` in a fresh worktree of this repository (Linux): 105 packages in 3 s, both notices.
- Not run: the app on Windows (npm through `cmd`, the user's cache).
