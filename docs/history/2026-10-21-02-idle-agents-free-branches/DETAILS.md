# 2026-10-21: idle agents no longer keep merged branches

Scope: [selfdev-001](../../features/self-development/SPEC.md) branch cleanup, found by the user while testing [#34](https://github.com/MomSesImSpcl/ai-workspace/issues/34): after PR #53 merged and the app restarted, its branch stayed and could not be removed.

## Outcome

- `app/src/turn.ts`: Stop while a session host is idle now ends the host instead of being ignored.
- `app/src/sessions.ts`: `endIdleHost` asks an idle host to end and waits for it (10 s); it refuses while the agent works.
- `app/src/branches.ts`: `busy` means an agent is working on a turn (`sessionWorking`), not that a host process exists. `removeBranch` and `cleanupBranches` are async and end idle hosts before removing the folder, which Windows keeps in use while a process runs in it. The start-up cleanup no longer delays the UI.

## Checks

- `npm run typecheck` clean, `npm test` 89/89; new test in `app/test/worktrees.test.ts`: a merged branch with an idle host is not busy, the cleanup ends the host and removes the branch.
