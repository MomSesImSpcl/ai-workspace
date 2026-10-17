# Developing the workspace inside itself

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

The user plans to move development of this repository into the workspace as soon as it is ready. Today that happens in external agent apps that create a Git worktree per session. This feature keeps that safety when the workspace edits its own code while running.

## Requirements

- **selfdev-001 — Worktree per change:** A session or task that changes the workspace's own repository MUST work in its own Git worktree and branch from the current `main`, never in the checkout the running app is started from. Worktree creation, sync with `main` and cleanup of merged worktrees use [version-control](../version-control/SPEC.md); a worktree another active session uses is never removed.
- **selfdev-002 — Running instance untouched:** Agent edits, installs and builds MUST NOT change the files, dependencies or storage of the running instance. Tool-broker path checks enforce this for the agent's tools; it is not left to model instructions ([architecture 3.3](../../ARCHITECTURE.md#33-data-isolation-and-data-classification)).
- **selfdev-003 — Verify in the worktree:** Before review, run the repository's own checks in the worktree (`npm run typecheck` and `npm test` in `app/` today) and, for UI changes, [ui-verification](../ui-verification/SPEC.md) against an instance started from the worktree. Results, diff and screenshots are kept with the session or task as evidence.
- **selfdev-004 — Review before applying:** Merging into `main` needs the user's approval under the existing approval and permission rules ([ADR 0004](../../architecture/decisions/0004-agent-native-permissions.md)); no agent merges its own change into the running app unasked.
- **selfdev-005 — Apply by restart:** After merge, the running app offers a restart onto the new code. Sessions and tasks MUST survive it: running turns are either finished first or recorded as interrupted and resumable ([sessions](../sessions/SPEC.md), [task-runtime](../task-runtime/SPEC.md)). The session that requested the restart continues afterwards.
- **selfdev-006 — Fall back:** If the new version fails to start or fails its startup check, the user MUST be able to start the last working version (the previous `main` commit) without manual Git work, and see why the new one failed. Storage format changes need a migration that the previous version tolerates or a backup taken before the restart ([workspace-transfer](../workspace-transfer/SPEC.md)).
- **selfdev-007 — Not only this repository:** The same flow applies to any project whose running app the user develops in the workspace; this workspace is the first case.

Agent dependence: worktree work, approvals and interruption rely on the [integration matrix](../../INTEGRATIONS.md) rows "Own tools, settings and permissions (ADR 0004)", "Relay "ask" prompts as approval cards" and "Stop a turn"; agents without approval relay fall back to the workspace approval check before merge.

## Acceptance evidence

- From a workspace session, an agent changes a UI label in a new worktree; typecheck, tests and a UI check pass there; the running app is unchanged until the user approves the merge.
- After approval and restart, the app runs the new code and the session that made the change continues with its history.
- A change that breaks startup leads to an offer to start the previous version, with the error shown.

## Non-goals and open decisions

- No automatic merge or deploy without approval; no hot code swap of the running process.
- Open: where workspace-managed worktrees live; contents of the startup check; whether the previous version runs from a kept worktree or a fresh checkout of the previous commit.
- Using the workspace on its own repository after the core was proposed earlier and is still not an agreed delivery order ([proposal record](../../history/2026-10-16-00-imported-progress-snapshot/DETAILS.md#proposed-not-yet-agreed)).
