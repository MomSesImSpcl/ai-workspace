# Details

## Changes

- `app/src/worktrees.ts` (new): `worktreesOn`, `planWorktree`, `addWorktree`; git only, no session state.
- `app/src/sessions.ts`: `Session.worktree`, planned in `createSession`; `sessionRoot` returns it.
- `app/src/turn.ts`: `workRoot` makes the worktree at the first turn, emits the notice, and throws when a made worktree is gone; checked every turn.
- `app/src/tasks.ts`: `createTask` copies the chat's (or parent task's) worktree.
- `app/src/store.ts`, `app/src/ui.ts`, `app/src/ui.html`: `Project.worktrees`, `setProjectWorktrees`, `POST /api/projects/<id>/worktrees`, a checkbox item in the project menu.

## Verification

- `app/test/worktrees.test.ts`: switch default off for another repository and on for the app's own; planned worktree not made before use; first turn runs in the worktree with the branch and notice; a chat's task gets the same worktree and runs there; after `git worktree remove`, the next turn starts no agent and shows the error.
- `npm run typecheck` clean; `npm test` 52/52.
- Browser UI from this checkout with throwaway storage: the project was detected as the app's own (switch on), the menu showed "✓ New worktree per session", and toggling it off and on was saved.
- Not run: a real Claude Code or Codex session in a workspace-made worktree (M1 exit criterion 1).

## Limits

- A chat's tasks that run at the same time share one worktree and can edit the same files.
- Nothing yet stops an agent from writing outside its worktree (selfdev-002).
- The worktree has no `node_modules`; the agent installs dependencies before running checks.
