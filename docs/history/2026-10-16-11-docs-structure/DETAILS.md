# 2026-10-16 — Docs structure: history folders, feature status, ADR index

- **Scope:** user request: (1) history per work item with short summary and details; (2) feature status without moving folders; (3) ADR index; (4) make ADRs explicit in the workflow.
- **Outcome:** `history/2026-10.md` split into `2026-10-16-00…10-*/` folders (`SUMMARY.md` + `DETAILS.md`, original text kept, relative links rebased) plus [history README](../README.md). `**Status:**` line in all feature summaries (5 in-progress from core slice 1, rest not-started) and markers in the [overview](../../OVERVIEW.md). [ADR index](../../architecture/decisions/README.md); [ADR rules](../../WORKING_AGREEMENT.md#architecture-decision-records) and status/ADR/history steps in the working agreement, AGENTS.md, the feature-writing guide and the project-history spec. Moving finished features to another folder was rejected: it breaks incoming links and features get reopened.
- **Checks:** all relative Markdown links resolve (script check); no remaining references to monthly history files outside history itself.
- **Branch / commit:** `feature/core-slice` and `main`; commit ID from Git.
