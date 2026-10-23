# Milestones

A milestone is a goal agreed with the user and checked by observable exit criteria. It is the only place a delivery order lives; feature specs stay free of order. When choosing the next scope, prefer requirements of the active milestone. Requirements stay in their owning specs; milestones only link to them by ID.

Each milestone lists **Required** requirements (the milestone is not reached without them) and **Helps** (worth doing for the goal, not blocking). At most one milestone is active. A reached milestone is recorded in [history](history/) and marked done here.

## M1 — The workspace develops itself

**Status:** active (agreed 2026-10-17)

**Goal:** Do the development of this repository from inside the workspace instead of an external agent app, without risking the running instance.

**Exit criteria** (one real feature branch, end to end, inside the workspace; the agent does the Git and GitHub work, as it does outside the workspace):

1. Start a session for this repository with Claude Code, and once more with Codex; the workspace starts it in its own new worktree and branch from current `main`.
2. Chat with the agent through the change with live activity, Stop and approval cards; the running app and its storage stay untouched.
3. The agent runs `npm run typecheck` and `npm test` in the worktree and reports the results in the chat.
4. On the user's approval in the chat, the agent commits, pushes its branch and merges it into `main` through a pull request once the required checks pass ([ADR 0016](architecture/decisions/0016-main-ruleset.md)).
5. Restart the app onto the new code; sessions survive and the requesting session continues. If the new code fails to start, start the previous version.
6. The agent cleans up merged worktrees and branches; the workspace notices a removed worktree in its session.
7. The agent resolves a merge conflict itself; the workspace needs no own conflict view.

**Required:**

- Acceptance blocker (agreed 2026-10-21): [#62 — stale session/branch publication binding](https://github.com/MomSesImSpcl/ai-workspace/issues/62) must be fixed and verified before M1 can be accepted as finished. Fix built 2026-10-22 ([selfdev-008](features/self-development/SPEC.md#requirements), [ADR 0019](architecture/decisions/0019-binding-check-and-continuation.md)) and covered by automated tests; verification in the app with real agents and a real pull request is still open.
- Acceptance blocker (agreed 2026-10-23): [#76 — start-up cleanup removes unmerged idle branches](https://github.com/MomSesImSpcl/ai-workspace/issues/76) must be fixed and verified before M1 can be accepted as finished (exit criterion 6). Specified 2026-10-23 as [selfdev-010](features/self-development/SPEC.md#requirements) ([ADR 0021](architecture/decisions/0021-cleanup-needs-merge-evidence.md)): removal only on a merged pull request confirmed for the current binding; not built yet.
- [self-development](features/self-development/SPEC.md) selfdev-001 (worktree per session, set by the workspace), selfdev-002 (running instance untouched), selfdev-003 and selfdev-004 (the agent verifies and asks before merging), selfdev-005 (apply by restart), selfdev-006 (fall back)
- [sessions](features/sessions/SPEC.md) sessions-021 (turn-start project state, so the agent sees what changed)
- Lean orchestrator and tasks (added 2026-10-18 by the user, to cut token use, also while testing; built 2026-10-18, [history](history/2026-10-18-10-lean-orchestrator-and-tasks/SUMMARY.md)): onboarding-010, orchestrator-005; closes [#16](https://github.com/MomSesImSpcl/ai-workspace/issues/16)
- Codex in sessions through `codex app-server` ([#14](https://github.com/MomSesImSpcl/ai-workspace/issues/14)), so Codex supports the same flow as Claude Code (built)
- [ai-orchestrator](features/ai-orchestrator/SPEC.md) orchestrator-004, effort part (added 2026-10-19 by the user): the orchestrator chooses an effort level for every task it starts, never leaving it to the agent's default, and the task card shows the level it runs with
- Write guard limits (added 2026-10-19 by the user): [#18](https://github.com/MomSesImSpcl/ai-workspace/issues/18) (shell paths computed at run time; no OS sandbox for Claude Code on Windows) and [#21](https://github.com/MomSesImSpcl/ai-workspace/issues/21) (command-wrapping hooks fail inside Codex's sandbox, so Codex worktree chats cannot run git; added 2026-10-20 by the user) are fixed, or closed by a decision of the user, before M1 is reached
- Worktree checks under Codex (added 2026-10-20 by the user): [#25](https://github.com/MomSesImSpcl/ai-workspace/issues/25) (`npm test` stalls inside Codex's Windows sandbox) and [#26](https://github.com/MomSesImSpcl/ai-workspace/issues/26) (a new worktree has no dependencies installed) are fixed before M1 is reached, since exit criterion 3 needs both
- Merge approval for Codex (added 2026-10-20 by the user): the limits in [#31](https://github.com/MomSesImSpcl/ai-workspace/issues/31) are fixed, or closed by a decision of the user, before M1 is reached
- Restored chats continue (added 2026-10-21 by the user): unarchiving a chat whose branch was removed makes the branch again from `main`, so the requesting session can continue after its merge and cleanup (exit criterion 5)
- Already built and reused: sessions-001–008, 010, 018, 019 (session, live activity, Stop, approvals)

**Helps:**

- [version-control](features/version-control/SPEC.md) vcs-002 (status and changes), vcs-003 (commit), vcs-004 (sync), vcs-006 (branches), vcs-008 (safety): a visual history for users; for M1 the agent does Git through its own tools ([vcs-011](features/version-control/SPEC.md))
- [ui-verification](features/ui-verification/SPEC.md) uiverify-001–004, 007: evidence for UI changes before merge
- sessions-011–013 (replies and tasks continue after the window closes)
- sessions-017 (project defaults per role): workspace-wide role defaults exist in Settings since 2026-10-19; per-project defaults and its token cap are to be decided
- vcs-005 (history), vcs-007 (a conflict view in the workspace)

**Decision (2026-10-19, user):** Git and GitHub work is the agent's, also inside the workspace, so the version-control UI moves from Required to Helps. The workspace still owns what an agent cannot do reliably for itself: starting the session in its own worktree, and restarting onto new code with a fallback. Code indexing becomes M2 because it saves the most tokens next; the first release moves to M3.

**Decision (2026-10-18):** lean orchestrator and tasks are part of M1, so later M1 work and its tests cost fewer tokens.

**Decisions (2026-10-17):** merge conflicts go to the session's agent, no own conflict view for M1; the fallback start of the previous version (selfdev-006) is required, so a broken merge never leaves the user without a working workspace; both Claude Code and Codex must complete the flow.

## M2 — Code index

**Status:** next (goal only; exit criteria to agree with the user before it becomes active)

**Goal:** Agents find code and its documentation through the workspace's shared index instead of reading and searching files themselves, which saves the most tokens of the planned features.

**Known parts:** [code-index](features/code-index/SPEC.md) code-index-001–028 (priority languages) and 030–039 (documentation indexing and code linking); [code-documentation](features/code-documentation/SUMMARY.md), including codedoc-012, the pass that documents existing code to the rules once the index exists.

## M3 — First release

**Status:** later (goal only; exit criteria to agree with the user before it becomes active)

**Goal:** Publish the first GitHub release of the workspace, and from then on check for and install new releases from inside the app.

**Known parts:** [distribution](features/distribution/SPEC.md) distribution-006 (releases), distribution-007 (update check), distribution-008 (update from the workspace), distribution-004 (state survives upgrades); [onboarding](features/onboarding/SPEC.md) onboarding-001–009, 011–013 (agent readiness, first-start agent setup, roles as plain jobs, readiness before a task, privacy, agent detection, model catalog and token cost weights, what each agent loads anyway, Codex without its global AGENTS.md), so a new user is guided from install to a working agent (user, 2026-10-19).
