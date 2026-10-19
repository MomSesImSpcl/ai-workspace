# Details

## Changes

- `app/src/worktrees.ts`: `isGitRepo`; `worktreesOn` is false outside git; `listWorktrees` reads `git worktree list --porcelain` and keeps the workspace-made ones that still exist; `planWorktree` takes `'new'` or an existing path and refuses others.
- `app/src/sessions.ts`: `createSession` takes the choice (default `'new'` for tasks and the CLI).
- `app/src/ui.ts`: a new chat in a project with worktrees needs `worktree` (400 otherwise); `GET /api/projects/<id>/worktrees` with each creator session's title; turning the switch on for a folder outside git is refused; `git` in the project list.
- `app/src/ui.html`: a Worktree dropdown in the composer for new chats ("Choose worktree…", "New worktree", existing ones), protected from polling while open; the project menu switch is disabled with a hint outside git.

## Verification

- `app/test/worktrees.test.ts`: a folder without git never gets worktrees; a second chat continues the first one's worktree, runs there and makes nothing new; an unknown path is refused. `npm run typecheck` clean, `npm test` 53/53.
- Browser UI with throwaway storage: the dropdown showed "Choose worktree…" (disabled) and "New worktree"; sending without a choice showed "Choose a worktree first…"; the API refused a chat without a choice and the switch for a non-git folder, whose menu item was disabled.
- Not run: picking an existing worktree in the app with a real agent.
