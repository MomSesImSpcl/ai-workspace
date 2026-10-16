# AI Workspace

One project-agnostic, multi-user workspace for interactive AI and durable autonomous tasks. Configurable models and authorized local/cloud tools serve code, research, writing and creative projects through one core.

Agents: reading order and feature selection are in [AGENTS.md](../AGENTS.md). Summaries guide selection; full specs define behavior.

## Feature map

Each link opens `features/<feature>/SUMMARY.md`; its folder also contains `SPEC.md`. Marked entries are in progress; unmarked ones are not started. Each summary has a **Status** line.

- [Identity, projects and repository access](features/identity-projects/SUMMARY.md) — in progress
- [Desktop workspace and Task Center](features/desktop-client/SUMMARY.md) — in progress
- [Agent setup onboarding and readiness in the UI](features/onboarding/SUMMARY.md)
- [Mobile capture and cross-device task control](features/mobile-client/SUMMARY.md)
- [Task notifications and privacy-safe previews](features/notifications/SUMMARY.md)
- [Secure local and remote execution runners](features/runners/SUMMARY.md)
- [Durable autonomous tasks and context continuation](features/task-runtime/SUMMARY.md) — in progress
- [Model registry, role routing and provider adapters](features/model-routing/SUMMARY.md) — in progress
- [Evidence-based model evaluations and shadow tests](features/evaluations/SUMMARY.md)
- [Versioned skills and reusable capability workflows](features/skills/SUMMARY.md)
- [Typed tools, MCP and scoped execution](features/tool-broker/SUMMARY.md) — in progress
- [Architecture, implementation and review workflow](features/software-workflow/SUMMARY.md)
- [Generated analysis tools and task dashboards](features/mini-apps/SUMMARY.md)
- [Authorized search and selective context assembly](features/knowledge-retrieval/SUMMARY.md)
- [Semantic code indexing and change-aware knowledge](features/code-index/SUMMARY.md)
- [Version-matched local documentation registry](features/documentation/SUMMARY.md)
- [Project planning, wiki and public roadmap](features/project-planning/SUMMARY.md)
- [Project history and selective progress retrieval](features/project-history/SUMMARY.md)
- [Configurable orchestration, agent roles and context delegation](features/ai-orchestrator/SUMMARY.md) — in progress
- [Automatic long-term memory and project knowledge](features/memory/SUMMARY.md)
- [Hermes Agent and Hindsight evaluation and integration](features/hermes-hindsight/SUMMARY.md)
- [Technology discovery and build-versus-buy research](features/technology-catalog/SUMMARY.md)
- [Trusted infrastructure registry and dependency provisioning](features/provisioning/SUMMARY.md)
- [Workspace installation, packaging and cross-platform setup](features/distribution/SUMMARY.md)
- [Unity indexing, scene authoring and background validation](features/unity/SUMMARY.md)
- [Visual concepts and editable 3D asset pipelines](features/creative-assets/SUMMARY.md)
- [External animation, retargeting and cinematics](features/animation/SUMMARY.md)
- [Internal artwork and identity similarity screening](features/similarity-review/SUMMARY.md)
- [Video research, style guides and YouTube production](features/content-production/SUMMARY.md)
- [Optional browser and web-based AI interfaces](features/integrated-browser/SUMMARY.md)

## Shared references — load as needed

- [Requirement locations and evidence](REQUIREMENTS_TRACEABILITY.md) · [Current work](PROGRESS.md) · [History on demand](history/)
- [Architecture, security and quality contracts](ARCHITECTURE.md) · [Acceptance scenarios G1–G13](ACCEPTANCE.md) · [Dependency inventory](DEPENDENCIES.md)
- [Working agreement](WORKING_AGREEMENT.md) · [Open decisions](OPEN_DECISIONS.md) · [Nonbinding technology candidates](TECHNOLOGY_CANDIDATES.md)
- [Adding or changing features](ADDING_FEATURES.md)

Status: core slice 1 prototype (CLI) and the Electron workspace app (Task Center) implemented and verified on Windows; see [progress](PROGRESS.md). Desktop client is in progress; other features are planned.
