# Details

## Changes

- `app/src/worktrees.ts`: `WorktreeChoice` (`name` for a new one, `path` to continue); `planWorktree` checks the name (`^[A-Za-z0-9][A-Za-z0-9._-]{0,59}$`, no `..`, not ending in `.lock`) and refuses an existing branch or folder.
- `app/src/sessions.ts`: `createSession` takes the choice; without one (tasks, CLI) the worktree is named `aiws/<session id>`.
- `app/src/ui.ts`: a new chat in the app project needs `worktreeName` or `worktree`; validation errors return 400 with the message; the worktree list shows the title of each worktree's latest chat.
- `app/src/ui.html`: no menu for the app project; dropdown and name field left in the Send row with the same name check before sending; `worktreeGroups` puts the app project's sessions under one heading per branch ("Project folder" for older ones).

## Verification

- `app/test/worktrees.test.ts`: empty, invalid (`-x`, `a b`, `a/b`, `a..b`, `x.lock`, 61 characters) and taken names (`main`, a made one) refused; a named worktree gets that branch. `npm run typecheck` clean, `npm test` 54/54.
- Browser UI with throwaway storage: two chats created over the API appeared under the headings `ui-test-b` and `ui-test-a`; the app project showed no menu; sending without a name and with `a b` showed the two messages; the API refused a chat without a name and with an invalid one. No worktree or branch was made in the repository.
- Not run: continuing a named worktree with a real agent.
