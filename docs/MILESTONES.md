# Milestones

A milestone is a goal agreed with the user and checked by observable exit criteria. It is the only place a delivery order lives; feature specs stay free of order. When choosing the next scope, prefer requirements of the active milestone. Requirements stay in their owning specs; milestones only link to them by ID.

Each milestone lists **Required** requirements (the milestone is not reached without them) and **Helps** (worth doing for the goal, not blocking). At most one milestone is active. A reached milestone is recorded in [history](history/) and marked done here.

## M1 — The workspace develops itself

**Status:** draft, to review with the user (2026-10-17)

**Goal:** Do the development of this repository from inside the workspace instead of an external agent app, without risking the running instance.

**Exit criteria** (one real feature branch, end to end, inside the workspace):

1. Start a session for this repository; the agent works in its own new worktree and branch from current `main`.
2. Chat with the agent through the change with live activity, Stop and approval cards; the running app and its storage stay untouched.
3. See the branch's changes and diff, and the results of `npm run typecheck` and `npm test` run in the worktree.
4. Approve; the change is committed, merged into `main` and pushed.
5. Restart the app onto the new code; sessions survive and the requesting session continues. If the new code fails to start, start the previous version.
6. Merged worktrees and branches are cleaned up.

**Required:**

- [self-development](features/self-development/SPEC.md) selfdev-001–006
- [version-control](features/version-control/SPEC.md) vcs-002 (status and changes), vcs-003 (commit), vcs-004 (sync), vcs-006 (branches), vcs-008 (safety)
- [sessions](features/sessions/SPEC.md) sessions-017 (project defaults for agent, model and effort), sessions-021 (turn-start project state)
- Already built and reused: sessions-001–008, 010, 018, 019 (session, live activity, Stop, approvals)

**Helps:**

- [code-index](features/code-index/SPEC.md) priority languages (code-index-001–028): agents already search code themselves, so faster and more precise context, not a blocker
- [ui-verification](features/ui-verification/SPEC.md) uiverify-001–004, 007: evidence for UI changes before merge
- sessions-011–013 (replies and tasks continue after the window closes)
- Codex on `codex app-server` ([#14](https://github.com/MomSesImSpcl/ai-workspace/issues/14))
- vcs-005 (history), vcs-007 (conflicts)

**Open questions for review:** whether merge conflicts (vcs-007) must be handled in the workspace or may fall back to the agent or terminal; whether the fallback start (selfdev-006) is required for M1 or can follow; which agent must work for M1 (Claude Code only, or Codex too).
