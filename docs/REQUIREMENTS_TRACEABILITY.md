# Requirements traceability

This maps requirements to their owning specs and acceptance references, not a delivery order. Every feature is **not-started**; source files and executable test evidence are **none**. The user and agent choose each feature scope together.

Original numbered sections remain valid references inside the destination specs. Use section + numbered requirement or distinctive bullet for existing items; use stable IDs from [the feature-writing guide](ADDING_FEATURES.md) for new requirements. During implementation, add one row per affected requirement with source files, tests/evidence and status (`not-started`, `in-progress`, `validated`, `deferred`). Record reasons for deferrals; keep untouched future features grouped here.

| Requirement reference | Owning feature spec | Acceptance reference |
|---|---|---|
| 1 | [Identity, projects and repository access](features/identity-projects/SPEC.md) | G1, G2 |
| 2.1 | [Desktop workspace and Task Center](features/desktop-client/SPEC.md) | G3 |
| 2.2 | [Mobile capture and cross-device task control](features/mobile-client/SPEC.md) | G11 |
| 2.3 | [Task notifications and privacy-safe previews](features/notifications/SPEC.md) | Local spec / agreed scope |
| 3.2 | [Secure local and remote execution runners](features/runners/SPEC.md) | G11 |
| 4 | [Durable autonomous tasks and context continuation](features/task-runtime/SPEC.md) | G3, G4 |
| 5.1, 5.2 | [Model registry, role routing and provider adapters](features/model-routing/SPEC.md) | G6 |
| 5.3 | [Evidence-based model evaluations and shadow tests](features/evaluations/SPEC.md) | G6 |
| 6.1 | [Versioned skills and reusable capability workflows](features/skills/SPEC.md) | Local spec / agreed scope |
| 6.2 | [Typed tools, MCP and scoped execution](features/tool-broker/SPEC.md) | G5 |
| 6.3 | [Architecture, implementation and review workflow](features/software-workflow/SPEC.md) | Local spec / agreed scope |
| 6.4 | [Generated analysis tools and task dashboards](features/mini-apps/SPEC.md) | Local spec / agreed scope |
| 7.1, 7.4, knowledge-001 | [Authorized search and selective context assembly](features/knowledge-retrieval/SPEC.md) | G7 |
| 7.2 | [Semantic code indexing and change-aware knowledge](features/code-index/SPEC.md) | G7 |
| 7.3 | [Version-matched local documentation registry](features/documentation/SPEC.md) | G7 |
| planning-001–010 | [Project planning, wiki and public roadmap](features/project-planning/SPEC.md) | A1–A10 in owning spec; not-started; implementation/test evidence: none |
| history-001–006 | [Project history and selective progress retrieval](features/project-history/SPEC.md) | A1–A6 in owning spec; not-started; implementation/test evidence: none |
| 7.5 | [Configurable orchestration, agent roles and context delegation](features/ai-orchestrator/SPEC.md) | Local spec / agreed scope |
| orchestrator-001–003 | [Independent role selection, handoffs and compatibility](features/ai-orchestrator/SPEC.md#independently-selectable-roles) | A1–A3; not-started; implementation/test evidence: none |
| routing-001 | [Role and agent assignments](features/model-routing/SPEC.md#role-and-agent-assignments) | Local acceptance evidence; **in-progress** (core slice 1): role→integration config in `src/roles.ts`, test `test/core.test.ts` (roles); orchestration/planning adapters not built |
| 4.2, 4.3 (restart resume), 4.6 (token budget) | [Durable tasks](features/task-runtime/SPEC.md) | **in-progress** (core slice 1): `src/runtime.ts`, tests in `test/core.test.ts`; unit tests plus real Claude Code e2e (history 2026-10-16, increment 1b) |
| 5.2 (agent CLI adapter) | [Provider adapters](features/model-routing/SPEC.md#52-provider-adapters) | **in-progress** (core slice 1): `src/adapters/claude-code.ts`; one adapter only |
| 6.2 (scoped MCP tools, audit) | [Tool broker](features/tool-broker/SPEC.md) | **in-progress** (core slice 1): `src/broker.ts`, `src/mcp-server.ts`, tests in `test/core.test.ts` |
| browser-001 | [Planning-role handoff](features/integrated-browser/SPEC.md#planning-role-handoff) | Local browser handoff acceptance; not-started; implementation/test evidence: none |
| 7.6 | [Automatic long-term memory and project knowledge](features/memory/SPEC.md) | Local spec / agreed scope |
| hermes-hindsight-001–006 | [Hermes Agent and Hindsight evaluation and integration](features/hermes-hindsight/SPEC.md) | A1–A6 in owning spec; not-started; implementation/test evidence: none |
| 8 | [Technology discovery and build-versus-buy research](features/technology-catalog/SPEC.md) | G10 |
| 9.1, 9.2 | [Trusted infrastructure registry and dependency provisioning](features/provisioning/SPEC.md) | G5 |
| 10 | [Unity indexing, scene authoring and background validation](features/unity/SPEC.md) | G8, G9 |
| 11.1, 11.2 | [Visual concepts and editable 3D asset pipelines](features/creative-assets/SPEC.md) | G12 |
| 11.3, 11.4 | [External animation, retargeting and cinematics](features/animation/SPEC.md) | G12 |
| 11.5 | [Internal artwork and identity similarity screening](features/similarity-review/SPEC.md) | G13 |
| 12 | [Video research, style guides and YouTube production](features/content-production/SPEC.md) | Local spec / agreed scope |
| Integrated Browser | [Optional browser and web-based AI interfaces](features/integrated-browser/SPEC.md) | Local spec / agreed scope |

## Shared and planning material

2026-10-16: Hermes/Hindsight research is retained in the separate [evaluation and integration feature](features/hermes-hindsight/SPEC.md), alongside `hermes-hindsight-001–006`, acceptance A1–A6 and an ownership/overlap map. Existing memory, retrieval, orchestration, routing, task-runtime, tool, skill, catalog and provisioning requirements retain their owners. Concrete use case and adoption remain open; all affected product behavior is `not-started`, with no implementation/runtime acceptance evidence.

| Original source | Current owner | Treatment |
|---|---|---|
| Header, development continuity | [Overview](OVERVIEW.md), [progress/history contract](WORKING_AGREEMENT.md#progress-and-history), [current progress](PROGRESS.md), [monthly history](history/) | Compact current handoff; completed work/evidence retained in searchable monthly archives, read only as needed. Repository documentation workflow is distinct from the not-started structured-history product feature; [documentation evidence](history/2026-10.md#2026-10-16--compact-progress-preserved-history-and-future-structured-storage). |
| 0: vocabulary, principles, cross-platform, exclusions | [Shared principles](PRINCIPLES.md) | Consolidated without changing product scope or platform obligations. |
| 3.1, 3.3, 9.3, 13 | [Architecture/security/quality](ARCHITECTURE.md) | Shared implementation contracts, including all testing categories. |
| 14 | [Working agreement](WORKING_AGREEMENT.md), feature specs and [quality contracts](ARCHITECTURE.md) | Fixed sequence removed at the user’s request; relevant technical proofs retained with their owners. |
| 15 | [Acceptance](ACCEPTANCE.md) | All G1–G13 scenarios retained. |
| 16 | [Working agreement](WORKING_AGREEMENT.md) | Process retained; reading policy and documentation paths updated. |
| Appendix A | [Technology candidates](TECHNOLOGY_CANDIDATES.md) | Nonbinding status retained. |
| Appendix B | [Projects](features/identity-projects/SPEC.md), [models](features/model-routing/SPEC.md), [Unity](features/unity/SPEC.md) | Three illustrative contracts moved to their owners; not production schemas. |
| Appendix C | [Open decisions](OPEN_DECISIONS.md) | All 13 decisions retained; appended browser feature moved to its own folder. |

Orchestrator and memory numbered requirements retain their original 1–20 and 1–23 identities with shorter wording. No application implementation or requirements validation is implied by this documentation split.
