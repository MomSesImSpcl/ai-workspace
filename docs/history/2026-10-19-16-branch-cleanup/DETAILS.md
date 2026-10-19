# Details

## Changes

- `app/src/worktrees.ts`: `worktreeState` (merged: own commits all in the checkout's HEAD, start read from the branch reflog, so a fresh branch is never merged; commits ahead; uncommitted changes) and `deleteWorktree`.
- `app/src/branches.ts` (new): `branchInfo`, `folderSize`, `removeBranch` (refused while an agent runs; unmerged or unsaved work needs force), `cleanupBranches` (merged, clean, idle only), archiving of chats whose branch folder is gone.
- `app/src/cli.ts`: cleanup at `ui` start and every 24 hours.
- `app/src/ui.ts`: `GET /api/branches` with sizes, `POST /api/branches/remove`; `worktreeGone` in the session view.
- `app/src/ui.html`: "Branches of this app" in Settings → General (shown in the app project); removed branches' groups marked "removed"; their chats read only.

## Verification

- `app/test/worktrees.test.ts`: four branches (fresh, unmerged commit, merged, merged with uncommitted changes); the cleanup removes only the merged clean one, deletes its branch and archives its chat; removing the unmerged one without force is refused with the reason, with force it goes and its chat is archived. `npm run typecheck` clean, `npm test` 55/55.
- Browser UI with throwaway storage and a temporary worktree of this repository: the list showed the branch with its state and size; Remove… asked with the right text, removed the worktree and branch, and the list showed "No branches yet."
- Limits: a squash-merged branch counts as unmerged and stays for the user; size is read on each Settings open and can take seconds with large dependency folders.
