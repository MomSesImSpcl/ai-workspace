# ADR 0017 — Agents merge into main only through the workspace's request_merge, after the user's approval

Status: accepted (2026-10-20, chosen by the user), implemented 2026-10-20 for selfdev-003/004. Builds on [ADR 0015](0015-write-guard.md) (write guard) and [ADR 0016](0016-main-ruleset.md) (`main` only through checked pull requests).

## Context

[selfdev-004](../../features/self-development/SPEC.md) requires that no agent merges its own change into the running app unasked, and selfdev-002 forbids relying on instructions for such rules. ADR 0016 makes every change reach `main` through a pull request once Ubuntu, Windows and macOS checks pass, but the ruleset does not ask a person: an agent with a `gh` login could merge a green pull request on its own. Claude Code runs every command through the guard hook; Codex in an app-project worktree runs commands in its sandbox with approval `never`, so they never reach the workspace.

## Decision

- **One way to merge:** app-project chats and top-level tasks (not the orchestrator, not subtasks) get the workspace MCP tool `request_merge` (`app/src/merge.ts`, registered in `app/src/approval-server.ts`). It finds the branch's open pull request with `gh` (or opens it from the agent's title and body), shows one approval card with the checks the agent reports, and on Allow runs `gh pr merge --squash` itself, outside any agent sandbox, with the user's own `gh` login. On Deny, a stop or a failed merge (for example required checks still running) it merges nothing and tells the agent why.
- **Agents cannot merge themselves:** in app-project sessions the guard denies `gh pr merge` and `gh api …/pulls/N/merge` (Claude Code through the guard hook; Codex approval requests are declined), with a notice that points to `request_merge`. Codex worktree sessions get an empty `GH_CONFIG_DIR` for their shells, so `gh` there has no login (user's choice of three options, 2026-10-20); Codex already drops token-named variables such as `GH_TOKEN` from its shells. The workspace server keeps the user's `PATH`, `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA` and `SystemRoot`, so its own `gh` finds the login.
- **selfdev-003 as a rule:** those sessions are told to run `npm run typecheck` and `npm test` in `app/` (`npm.cmd` on Windows), report both, and merge only through `request_merge`. A missing report is visible in the chat and on the card, so an instruction suffices here.

## Rejected alternatives

- The agent merges itself after a guard card ("ask"): Codex in a worktree never asks, so the two agents would behave differently, and Codex's sandbox may lack `gh` credentials anyway.
- An instruction only: selfdev-004 would be unenforced.
- A required review in the ruleset: GitHub does not let the author approve their own pull request, so it would block the user too.

## Known limits

Tracked in [#31](https://github.com/MomSesImSpcl/ai-workspace/issues/31): the Codex block is not airtight (the GitHub API through `curl` and git's token); Codex loses every `gh` command in a worktree; the empty `GH_CONFIG_DIR` and the workspace server's `gh` login are untested on Windows. Squash merges and the branch cleanup: [#24](https://github.com/MomSesImSpcl/ai-workspace/issues/24).
