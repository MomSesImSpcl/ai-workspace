# 2026-10-16 — Core slice 1, increment 1: TypeScript CLI, Claude Code adapter, scoped broker

- **Scope / decision:** User agreed slice 1: TypeScript CLI, Claude Code as first adapter, Codex CLI (ChatGPT subscription) as later orchestrator, acceptance = restart resume, denied out-of-project write logged, budget pause. Decisions in [ADR 0001](../../architecture/decisions/0001-core-slice-stack.md). Requirements: routing-001, 4.2/4.3/4.6, 5.2, 6.2 (see traceability).
- **Outcome:** `src/` store, runtime (checkpointed steps, token budget pause, resume), broker (scope + write grant + audit), stdio MCP server, Claude Code adapter (built-in tools disabled, only workspace MCP), role config, CLI.
- **Checks:** `npm test` 7/7 pass (broker scope/write denial + audit, budget pause/resume, interrupted-task resume, adapter failure, role independence, Claude result parsing); `npx tsc` no errors. Real run via CLI reached Claude Code and failed cleanly with `Failed to authenticate: OAuth session expired and could not be refreshed`; task recorded `failed` with reason and audit. Real-agent e2e not yet verified.
- **Remaining:** user re-login of standalone `claude` CLI, then real e2e run; Codex adapter; known limits in ADR.
- **Branch / commit:** `feature/core-slice`; commit ID from Git.
