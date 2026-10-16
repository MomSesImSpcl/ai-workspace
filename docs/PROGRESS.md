# Current development progress

Read this file at startup. Search [monthly history](history/) only for relevant past decisions/evidence; read matching entries and expand if needed. Completed work and detailed checks belong there, under the [progress/history contract](WORKING_AGREEMENT.md#progress-and-history). Requirements/status remain in owning specs and [traceability](REQUIREMENTS_TRACEABILITY.md).

## Active / blocked

No application implementation scope is selected; all product features remain `not-started`. No implementation blockers have been established. Branch: `main`. The user authorized committing and pushing all pending documentation, including the pre-existing edits. This checkpoint covers role selection, planning/wiki, Hermes/Hindsight and progress/history; use Git for the current commit and publication status.

The authorized documentation scope is complete: compact progress, preserved monthly history, updated workflow references and the separate [project history feature](features/project-history/SPEC.md) (`history-001–006`). JSONL/SQLite are future candidates, not an implementation commitment.

## Agreed direction

Personal tool first; retain user/project identity in the core for later authorization. Build thin, tested end-to-end slices through identity/projects, task runtime, model routing and tool broker, with runners/desktop only as needed; choose each bounded scope and free-to-use technologies together. Existing solutions take precedence. Knowledge features retain one shared index (`knowledge-001`).

Planning/design, orchestration and implementation roles are independently selectable; local/hosted integrations require verification, and browser planning is optional ([role requirements](features/ai-orchestrator/SPEC.md#independently-selectable-roles)). [Planning/wiki/public roadmap](features/project-planning/SPEC.md) and [Hermes/Hindsight evaluation](features/hermes-hindsight/SPEC.md) are defined concepts, with no adoption or implementation authorized. Select their concrete use cases and acceptance/security checks when chosen. History retrieval/storage is likewise separately defined, without fixed priority.

## Proposed — not yet agreed

First core slice: one local project and restart-safe task, one model adapter, project-scoped MCP file tools, deterministic write permission checks and audit log, task token/cost tracking with a budget pause, and minimal CLI or local web UI. Exact scope, technologies and acceptance checks remain open.

Using the workspace on its own repository after the core and the longer tentative feature order remain proposals; see the [preserved proposal record](history/2026-10.md#proposed-not-yet-agreed). There is no fixed delivery sequence.

## Resume here

No implementation work remains authorized. Next product action: confirm the proposed first core slice with the user, or jointly select another bounded feature set from the [map](OVERVIEW.md). Then load only its full specs and affected architecture/security contracts. Cross-cutting choices remain in [open decisions](OPEN_DECISIONS.md); feature-specific choices stay in their owning specs.

Latest completed work, affected files and verification: [2026-10-16 progress/history update](history/2026-10.md#2026-10-16--compact-progress-preserved-history-and-future-structured-storage). Earlier planning, Hermes/Hindsight and role-selection evidence is retained in that month's archive. Documentation checks do not establish runtime or third-party integration behavior.
