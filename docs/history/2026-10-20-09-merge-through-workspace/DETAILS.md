# Details: merging through the workspace after approval (2026-10-20)

Scope: [selfdev-003/004](../../features/self-development/SPEC.md#requirements), M1 exit criteria 3 and 4, [ADR 0017](../../architecture/decisions/0017-merge-through-workspace.md). The user chose the workspace merge tool over agent-run merges and an instruction only, and for Codex the empty `GH_CONFIG_DIR` over an instruction only or a required review; the concerns are in [#31](https://github.com/MomSesImSpcl/ai-workspace/issues/31). Branch `claude/great-ride-93ynxs`, not merged.

## Changes

- `app/src/merge.ts` (new): `requestMerge` (one approval card first; on Allow `git push -u origin <branch>`, the pull request opened if missing, `gh pr merge --squash --auto`; Deny or a stop runs nothing; failures are reported to the agent), `mergeCommand`, `ghBlockArgs`, `MERGE_NOTE` (commit, no need to push). `AI_WORKSPACE_GH` and `AI_WORKSPACE_GIT` replace `gh` and `git` for tests.
- `app/src/approval-server.ts`: `request_merge` for app-project chats and top-level tasks, not the orchestrator or subtasks.
- `app/src/guard.ts`, `guard-hook.ts`: with `merge` set (app-project sessions), `gh pr merge` and the merge endpoint through `gh api` are denied with a notice.
- `app/src/adapters/claude-code.ts`: the guard's `merge` flag, `mcp__aiws__request_merge` allowed without a card, the note in the appended prompt.
- `app/src/adapters/codex.ts`: empty `GH_CONFIG_DIR` for worktree shells, merge approval requests declined, the note in the developer instructions, and `PATH`, `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `SystemRoot` passed to the workspace server so its `gh` finds the user's login.

## Verification

- `app/test/merge.test.ts`: merge commands recognized (also `gh.exe` by full path and `gh api … /merge`), others not; the guard denies them only with `merge` set; `request_merge` with a fake `gh` and `git`: Deny or a stop runs nothing, Allow pushes and then turns on auto-merge, a new pull request is opened after the push, a failed push stops before the pull request, a failed auto-merge is reported, an already merged one is refused; the empty `gh` folder exists under storage. `app/test/worktrees.test.ts`: the real workspace server offers `request_merge` to an app-project chat and its task, not to an orchestrator chat or another project. `npm run typecheck` is clean, and `npm test` passes 75/75 (Linux).
- Not run: the app with real agents and a real pull request; `gh` without a login inside Codex's Windows sandbox; the workspace server's `gh` under Codex on Windows.
- The user's in-app test on Windows (first version of this branch): Codex's `gh auth status` inside the sandbox reported no login (the empty `GH_CONFIG_DIR` works, the Credential Manager is not used). Claude Code refused `gh pr merge` from the workspace note, even as a test, so the guard did not fire; a harmless probe is `gh pr merge --help`. Codex ran typecheck, 75/75 tests and the private-data scan in the sandbox and committed, but `git push` failed there for lack of credentials (as already in the #23 test), so `request_merge` was never reached. Hence the change above: the app pushes after Allow and uses auto-merge, since a fresh pull request cannot merge before the four checks pass. Seen in passing: a reply split mid-word into two paragraphs ([#33](https://github.com/MomSesImSpcl/ai-workspace/issues/33)).
