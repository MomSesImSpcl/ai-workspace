# Current development progress

Read this file at startup. Search [history](history/) folder summaries only for relevant past decisions/evidence; read matching entries and expand if needed. Completed work and detailed checks belong there, under the [progress/history contract](WORKING_AGREEMENT.md#progress-and-history). Requirements/status remain in owning specs and [traceability](REQUIREMENTS_TRACEABILITY.md).

## Active / blocked

**Core slice 1: complete, merged into `main`** from `feature/core-slice` with user approval ([ADR 0001](architecture/decisions/0001-core-slice-stack.md)). TypeScript CLI; Claude Code as first agent adapter; Codex CLI on the ChatGPT subscription as the later orchestrator; any agent assignable to any role via config (routing-001). Acceptance: task survives a process kill and resumes; out-of-project or ungranted write is denied and audited; token budget overrun pauses the task.

Increments 1–4 done and verified: unit tests 14/14; real e2e for Claude Code (Implementation), Codex CLI (Orchestration, dedicated `CODEX_HOME` login), and Codex delegating a subtask to Claude Code with inherited scope, budget ceiling and usage charged to the parent. Budget pause and kill/resume also verified against real Claude Code; now with mid-step budget stop and an effect ledger so a re-run step does not repeat committed writes ([evidence](history/2026-10-16-08-core-slice-1-increment-4/SUMMARY.md)); remaining: one model turn can overshoot. No blockers.

## Agreed direction

Personal tool first; retain user/project identity in the core for later authorization. Build thin, tested end-to-end slices through identity/projects, task runtime, model routing and tool broker, with runners/desktop only as needed; choose each bounded scope and free-to-use technologies together. Existing solutions take precedence. Knowledge features retain one shared index (`knowledge-001`).

Planning/design, orchestration and implementation roles are independently selectable; local/hosted integrations require verification, and browser planning is optional ([role requirements](features/ai-orchestrator/SPEC.md#independently-selectable-roles)). [Planning/wiki/public roadmap](features/project-planning/SPEC.md) and [Hermes/Hindsight evaluation](features/hermes-hindsight/SPEC.md) are defined concepts, with no adoption or implementation authorized. Select their concrete use cases and acceptance/security checks when chosen. History retrieval/storage is likewise separately defined, without fixed priority.

## Proposed — not yet agreed

Using the workspace on its own repository after the core and the longer tentative feature order remain proposals; see the [preserved proposal record](history/2026-10-16-00-imported-progress-snapshot/DETAILS.md#proposed-not-yet-agreed). There is no fixed delivery sequence.

## Resume here

Setup is documented in the README; the [distribution feature](features/distribution/SPEC.md) lists triggers for installers/containers, to evaluate after each feature set. Next action: choose the next feature set with the user from the [map](OVERVIEW.md); known slice 1 gaps are listed in [ADR 0001](architecture/decisions/0001-core-slice-stack.md#known-limits). Latest evidence: [CI, license, cleanup](history/2026-10-16-13-ci-license-cleanup/SUMMARY.md); slice 1 result: [increment 4](history/2026-10-16-08-core-slice-1-increment-4/SUMMARY.md). Cross-cutting choices remain in [open decisions](OPEN_DECISIONS.md).
