# Write guard: Windows test — details

Setup: the app ran from a worktree checked out at #19's head, `AI_WORKSPACE_HOME` set to a short throwaway folder, UI on another port; the user's running app and storage were not used.

Claude Code, chat in default mode, tasks in bypass mode:
- Write in its worktree and `git commit`: allowed (after the normal approval card).
- Write tool and `echo x > …` into the checkout: blocked, with the guard notice in the chat (the command notice names the read list).
- `ls` of the checkout: passed the guard (read-only).
- Write into storage: blocked.

Codex, sandbox `workspace-write` (full access gets the same writable roots):
- Commit in the worktree: succeeded without an approval card. Git warned `Unable to create '<checkout>/.git/packed-refs.lock': Permission denied`; the commit is unaffected (accepted, #20 closed).
- Writes into the checkout, its `.git/hooks` and storage: denied by the sandbox.

Found:
- [#21](https://github.com/MomSesImSpcl/ai-workspace/issues/21): a command-wrapping hook (`rtk`) cannot start inside Codex's sandbox, so `git` fails; `git.exe` by full path works. Added to M1 by the user.
- [#22](https://github.com/MomSesImSpcl/ai-workspace/issues/22): on a long storage path, worktree creation failed with `fatal: '$GIT_DIR' too big` and left the new branch behind.
