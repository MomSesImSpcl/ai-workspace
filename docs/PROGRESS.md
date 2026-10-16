# Current development progress

Read this file at startup. Search [monthly history](history/) only for relevant past decisions/evidence; read matching entries and expand if needed. Completed work and detailed checks belong there, under the [progress/history contract](WORKING_AGREEMENT.md#progress-and-history). Requirements/status remain in owning specs and [traceability](REQUIREMENTS_TRACEABILITY.md).

## Active / blocked

**Active scope: core slice 1** on branch `feature/core-slice` ([ADR 0001](architecture/decisions/0001-core-slice-stack.md)). TypeScript CLI; Claude Code as first agent adapter; Codex CLI on the ChatGPT subscription as the later orchestrator; any agent assignable to any role via config (routing-001). Acceptance: task survives a process kill and resumes; out-of-project or ungranted write is denied and audited; token budget overrun pauses the task.

Increments 1–3 done and verified: unit tests 9/9; real e2e for Claude Code (Implementation), Codex CLI (Orchestration, dedicated `CODEX_HOME` login), and Codex delegating a subtask to Claude Code with inherited scope, budget ceiling and usage charged to the parent. Budget pause and kill/resume also verified against real Claude Code; known gaps: a step can overshoot the budget, and a killed step re-runs so its side effects repeat ([evidence](history/2026-10.md#2026-10-16--core-slice-1-real-budget-pause-and-killresume-checks)). No blockers.

## Agreed direction

Personal tool first; retain user/project identity in the core for later authorization. Build thin, tested end-to-end slices through identity/projects, task runtime, model routing and tool broker, with runners/desktop only as needed; choose each bounded scope and free-to-use technologies together. Existing solutions take precedence. Knowledge features retain one shared index (`knowledge-001`).

Planning/design, orchestration and implementation roles are independently selectable; local/hosted integrations require verification, and browser planning is optional ([role requirements](features/ai-orchestrator/SPEC.md#independently-selectable-roles)). [Planning/wiki/public roadmap](features/project-planning/SPEC.md) and [Hermes/Hindsight evaluation](features/hermes-hindsight/SPEC.md) are defined concepts, with no adoption or implementation authorized. Select their concrete use cases and acceptance/security checks when chosen. History retrieval/storage is likewise separately defined, without fixed priority.

## Proposed — not yet agreed

Using the workspace on its own repository after the core and the longer tentative feature order remain proposals; see the [preserved proposal record](history/2026-10.md#proposed-not-yet-agreed). There is no fixed delivery sequence.

## Resume here

Next action: agree with the user whether slice 1 is complete (optionally run budget pause and kill/resume against a real agent) and whether to merge `feature/core-slice` into `main`, then choose the next feature set. Latest evidence: [increment 3](history/2026-10.md#2026-10-16--core-slice-1-increment-3-orchestrator-delegates-to-implementation). Cross-cutting choices remain in [open decisions](OPEN_DECISIONS.md).
