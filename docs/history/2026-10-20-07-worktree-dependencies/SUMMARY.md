# Dependencies in a new worktree

#26, M1 step 2 increment A: a new worktree gets `npm ci` from the app before the agent's first turn, outside any agent sandbox and with the user's normal npm cache, so the agent can run typecheck and tests at once. Notices show the install; a failure is reported and does not stop the session. Branch `claude/great-ride-93ynxs`. [Details](DETAILS.md).
