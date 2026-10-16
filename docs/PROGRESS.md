# Current development progress

Read this file at startup. Search [monthly history](history/) only for relevant past decisions/evidence; read matching entries and expand if needed. Completed work and detailed checks belong there, under the [progress/history contract](WORKING_AGREEMENT.md#progress-and-history). Requirements/status remain in owning specs and [traceability](REQUIREMENTS_TRACEABILITY.md).

## Active / blocked

**Active scope: core slice 1** on branch `feature/core-slice` ([ADR 0001](architecture/decisions/0001-core-slice-stack.md)). TypeScript CLI; Claude Code as first agent adapter; Codex CLI on the ChatGPT subscription as the later orchestrator; any agent assignable to any role via config (routing-001). Acceptance: task survives a process kill and resumes; out-of-project or ungranted write is denied and audited; token budget overrun pauses the task.

Increment 1 done and verified: unit tests 7/7 and a real Claude Code e2e (scoped write allowed, out-of-project read denied, both audited). Budget pause and kill/resume are verified with a fake adapter only. No blockers.

## Agreed direction

Personal tool first; retain user/project identity in the core for later authorization. Build thin, tested end-to-end slices through identity/projects, task runtime, model routing and tool broker, with runners/desktop only as needed; choose each bounded scope and free-to-use technologies together. Existing solutions take precedence. Knowledge features retain one shared index (`knowledge-001`).

Planning/design, orchestration and implementation roles are independently selectable; local/hosted integrations require verification, and browser planning is optional ([role requirements](features/ai-orchestrator/SPEC.md#independently-selectable-roles)). [Planning/wiki/public roadmap](features/project-planning/SPEC.md) and [Hermes/Hindsight evaluation](features/hermes-hindsight/SPEC.md) are defined concepts, with no adoption or implementation authorized. Select their concrete use cases and acceptance/security checks when chosen. History retrieval/storage is likewise separately defined, without fixed priority.

## Proposed — not yet agreed

Using the workspace on its own repository after the core and the longer tentative feature order remain proposals; see the [preserved proposal record](history/2026-10.md#proposed-not-yet-agreed). There is no fixed delivery sequence.

## Resume here

Next action: increment 2, the Codex CLI adapter (`codex exec`, ChatGPT subscription login) for the Orchestration role. Codex is not installed on this machine yet. Latest evidence: [increment 1b](history/2026-10.md#2026-10-16--core-slice-1-increment-1b-real-claude-code-end-to-end). Cross-cutting choices remain in [open decisions](OPEN_DECISIONS.md).
