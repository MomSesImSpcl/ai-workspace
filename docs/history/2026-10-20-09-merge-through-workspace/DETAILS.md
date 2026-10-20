# Details: merging through the workspace after approval (2026-10-20)

Scope: [selfdev-003/004](../../features/self-development/SPEC.md#requirements), M1 exit criteria 3 and 4, [ADR 0017](../../architecture/decisions/0017-merge-through-workspace.md). The user chose the workspace merge tool over agent-run merges and an instruction only, and for Codex the empty `GH_CONFIG_DIR` over an instruction only or a required review; the concerns are in [#31](https://github.com/MomSesImSpcl/ai-workspace/issues/31). Branch `claude/great-ride-93ynxs`, not merged.

## Changes

- `app/src/merge.ts` (new): `requestMerge` (find or open the branch's pull request with `gh`, one approval card, `gh pr merge --squash` on Allow; Deny, a stop or a failed merge merge nothing and tell the agent why), `mergeCommand`, `ghBlockArgs`, `MERGE_NOTE`. `AI_WORKSPACE_GH` replaces `gh` for tests.
- `app/src/approval-server.ts`: `request_merge` for app-project chats and top-level tasks, not the orchestrator or subtasks.
- `app/src/guard.ts`, `guard-hook.ts`: with `merge` set (app-project sessions), `gh pr merge` and the merge endpoint through `gh api` are denied with a notice.
- `app/src/adapters/claude-code.ts`: the guard's `merge` flag, `mcp__aiws__request_merge` allowed without a card, the note in the appended prompt.
- `app/src/adapters/codex.ts`: empty `GH_CONFIG_DIR` for worktree shells, merge approval requests declined, the note in the developer instructions, and `PATH`, `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `SystemRoot` passed to the workspace server so its `gh` finds the user's login.

## Verification

- `app/test/merge.test.ts`: merge commands recognized (also `gh.exe` by full path and `gh api … /merge`), others not; the guard denies them only with `merge` set; `request_merge` with a fake `gh`: Deny merges nothing, Allow merges, a missing pull request needs a title and is then opened, a failed merge says to call again, an already merged one is refused; the empty `gh` folder exists under storage. `app/test/worktrees.test.ts`: the real workspace server offers `request_merge` to an app-project chat and its task, not to an orchestrator chat or another project. `npm run typecheck` is clean, and `npm test` passes 75/75 (Linux).
- Not run: the app with real agents and a real pull request; `gh` without a login inside Codex's Windows sandbox; the workspace server's `gh` under Codex on Windows.
