# ADR 0017 — Agents merge into main only through the workspace's request_merge, after the user's approval

Status: accepted (2026-10-20, chosen by the user), implemented 2026-10-20 for selfdev-003/004. Builds on [ADR 0015](0015-write-guard.md) (write guard) and [ADR 0016](0016-main-ruleset.md) (`main` only through checked pull requests).

## Context

[selfdev-004](../../features/self-development/SPEC.md) requires that no agent merges its own change into the running app unasked, and selfdev-002 forbids relying on instructions for such rules. ADR 0016 makes every change reach `main` through a pull request once Ubuntu, Windows and macOS checks pass, but the ruleset does not ask a person: an agent with a `gh` login could merge a green pull request on its own. Claude Code runs every command through the guard hook; Codex in an app-project worktree runs commands in its sandbox with approval `never`, so they never reach the workspace.

## Decision

- **One way to merge:** app-project chats and top-level tasks (not the orchestrator, not subtasks) get the workspace MCP tool `request_merge` (`app/src/merge.ts`, registered in `app/src/approval-server.ts`). It shows one approval card first (branch, existing pull request or the agent's title for a new one, and the checks the agent reports); nothing happens before the answer. On Allow the app, outside any agent sandbox and with the user's own git and `gh` credentials, pushes the branch, opens the pull request if there is none, and turns on auto-merge (`gh pr merge --squash --auto`), so GitHub squash-merges once the required checks pass and a failing check merges nothing (amended 2026-10-20 after the user's Windows test: Codex cannot push from its Windows sandbox, and a fresh pull request cannot merge before its checks). On Deny or a stop it runs nothing; a failed push or `gh` call is reported to the agent.
- **Agents cannot merge themselves:** in app-project sessions the guard denies `gh pr merge` and `gh api …/pulls/N/merge` (Claude Code through the guard hook; Codex approval requests are declined), with a notice that points to `request_merge`. Codex worktree sessions get an empty `GH_CONFIG_DIR` for their shells, so `gh` there has no login (user's choice of three options, 2026-10-20); Codex already drops token-named variables such as `GH_TOKEN` from its shells. The workspace server keeps the user's `PATH`, `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA` and `SystemRoot`, so its own `gh` finds the login.
- **selfdev-003 as a rule:** those sessions are told to run `npm run typecheck` and `npm test` in `app/` (`npm.cmd` on Windows), report both, and merge only through `request_merge`. A missing report is visible in the chat and on the card, so an instruction suffices here.

## Rejected alternatives

- The agent merges itself after a guard card ("ask"): Codex in a worktree never asks, so the two agents would behave differently, and Codex's sandbox may lack `gh` credentials anyway.
- An instruction only: selfdev-004 would be unenforced.
- A required review in the ruleset: GitHub does not let the author approve their own pull request, so it would block the user too.

## Amendment 2026-10-20: up to date first

After Allow and before the push, `request_merge` runs `git fetch origin main` and `git merge --no-edit origin/main`, because the ruleset now merges only up-to-date branches ([ADR 0016](0016-main-ruleset.md)). On a conflict it aborts the merge, pushes nothing and tells the agent to merge `main` itself, check again and retry.

## Amendment 2026-10-20: read_repo and a stricter note

- `MERGE_NOTE` now forbids every other way to merge (`gh pr merge`, the GitHub API, curl, a push to `main`) and points to `read_repo`. The user accepted that this is a rule, not a lock ([#31](https://github.com/MomSesImSpcl/ai-workspace/issues/31) point 1).
- The workspace MCP server gives every session and task the read-only tool `read_repo` (`app/src/repo-read.ts`): `log` and `show` through git, `prs`, `pr` (checks, and with `logs` the failed lines of failed GitHub Actions jobs), `issues` and `issue` through gh, for any workspace project, at most 30,000 characters per answer, refs checked so git cannot take them as options. The orchestrator runs it without a card (`ORCHESTRATOR_TOOLS`); Claude Code tasks have it allowed. It replaces what Codex lost with its gh login (#31 point 2).

## Amendment 2026-10-22: binding checked before and after the card

[ADR 0019](0019-binding-check-and-continuation.md) ([#62](https://github.com/MomSesImSpcl/ai-workspace/issues/62)): `request_merge` refuses before the card when the worktree no longer has the session's branch checked out (or is gone or foreign), checks that again after Allow before any git command, and treats a merged pull request as this branch's only when its head commit is in the branch, so a branch made again under the same name can publish a new one. The merged-PR guard also runs after Allow.

## Known limits

Tracked in [#31](https://github.com/MomSesImSpcl/ai-workspace/issues/31): the Codex block is not airtight (the GitHub API through `curl` and git's token); Codex loses every `gh` command in a worktree; the empty `GH_CONFIG_DIR` and the workspace server's `gh` login are untested on Windows. Squash merges and the branch cleanup: [#24](https://github.com/MomSesImSpcl/ai-workspace/issues/24).
