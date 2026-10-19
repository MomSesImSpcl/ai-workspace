# Details

## Changes

- `app/src/worktrees.ts`: `appRepo` (git root of the checkout the app runs from; `AI_WORKSPACE_REPO` for tests), `isAppProject`, `addAppProject`; the per-project switch, `worktreesOn` and `isGitRepo` are gone.
- `app/src/cli.ts`: `ui` adds the app project at start.
- `app/src/store.ts`: `Project.worktrees` and `setProjectWorktrees` removed.
- `app/src/ui.ts`: `app` in the project list; removing the app project is refused; the switch route is gone.
- `app/src/ui.html`: the app project first with a separator and a "this app" label; its menu has no Remove; the switch item is gone.

## Verification

- `app/test/worktrees.test.ts`: only the app project gets worktrees; `addAppProject` adds nothing when a project has the folder and adds it under its folder name in fresh storage; tests run from a checkout. `npm run typecheck` clean, `npm test` 53/53.
- Browser UI with throwaway storage holding one other project: at start the app project was added, listed first, a separator followed, its menu showed only "Archive…", the other project's menu kept "Remove from workspace…", and the API refused removing the app project.
