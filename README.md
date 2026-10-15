# AI Workspace

A planned, project-agnostic workspace for interactive AI, durable background tasks, configurable models and authorized local/cloud tools. This repository currently contains the product specification and development instructions; the application has not been implemented.

## Start or continue with an agent

Read [AGENTS.md](AGENTS.md), then the [feature map](docs/OVERVIEW.md), [shared principles](docs/PRINCIPLES.md) and [current progress](docs/PROGRESS.md). To choose new work, start with feature titles and discuss them with the user; open only useful short summaries. Load full specs after agreeing on the feature set, or when the user explicitly asks for deeper analysis.

You can give an agent this instruction with the repository URL:

> Read AGENTS.md and resume from docs/PROGRESS.md. Follow any scope I have already selected; otherwise discuss feature titles with me, open short summaries only as needed, and help choose what to build next before loading full specs.

There is no fixed build order. The user and agent choose each feature set together, agree on a bounded outcome and acceptance checks, then implement and verify it.

## Repository guide

- [Feature map](docs/OVERVIEW.md): descriptive titles and paths to all capabilities.
- [Adding or changing features](docs/ADDING_FEATURES.md): concise specification rules and registration checklist.
- [Working agreement](docs/WORKING_AGREEMENT.md): implementation, verification and handoff rules.
- [Progress](docs/PROGRESS.md) and [requirement traceability](docs/REQUIREMENTS_TRACEABILITY.md): current work, evidence and what remains.
- [Architecture, security and quality](docs/ARCHITECTURE.md): shared contracts; [open decisions](docs/OPEN_DECISIONS.md): choices to resolve when relevant.

Each `docs/features/<feature>/` folder contains exactly `SUMMARY.md` and `SPEC.md`. Application setup/build commands will be documented when runnable code exists.
