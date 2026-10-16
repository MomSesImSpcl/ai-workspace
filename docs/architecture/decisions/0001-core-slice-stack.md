# ADR 0001 — Core slice 1: TypeScript CLI with agent-CLI adapters

Status: accepted (2026-10-16, agreed with the user). Branch: `feature/core-slice`.

## Context

The first core slice needs one local project, a restart-safe task, one agent adapter, project-scoped MCP file tools with deterministic permission checks and audit, a budget pause and a minimal UI. The user wants hosted agents that run on existing subscriptions, not paid APIs, and any agent assignable to any role later ([routing-001](../../features/model-routing/SPEC.md#role-and-agent-assignments)).

## Decision

- **Language/runtime:** TypeScript on Node ≥ 24, run directly via Node type stripping (no build step); `tsc` only typechecks. Chosen for first-class MCP and Claude Agent SDKs and one language for later desktop/browser work. Python stays an option for later ML-heavy services.
- **UI:** CLI (`node src/cli.ts`).
- **Adapters are agent products, not models.** `AgentAdapter.step()` runs one bounded step and reports usage. First adapter: Claude Code in print mode (`claude -p --output-format json`) with all built-in tools disabled (`--tools ""`) and only the workspace MCP server allowed (`--strict-mcp-config --allowedTools mcp__ws`), so every file access passes through the broker. Up to 8 turns per step; `--resume` continues the CLI session as a hint only — durable state is the workspace task file.
- **Orchestrator (next):** Codex CLI (`codex exec`) signed in with the user's ChatGPT subscription. The ChatGPT app/agent UI is not automated (no programmatic interface; browser automation is fragile and may breach terms). Browser-only planning remains a manual handoff (`manual-browser`).
- **Roles:** `~/.ai-workspace/roles.json` maps role → integration over defaults (`ArchitectureReasoning→manual-browser`, `Orchestration→codex`, `Implementation→claude-code`). Integrations without an adapter fail explicitly.
- **State:** workspace home (`AI_WORKSPACE_HOME`, default `~/.ai-workspace`) outside projects, because project content is untrusted for privilege decisions. Tasks are JSON written atomically (temp + rename); audit is append-only JSONL.
- **Budget:** token budget (input incl. cache + output), checked before each step. Subscription agents give token counts but no real per-call price; provider-reported cost is shown as an estimate only.

## Rejected

- ChatGPT web UI via embedded Chromium as orchestrator: no usage data, fragile, terms risk.
- OpenAI/Anthropic paid APIs first: user prefers subscriptions.
- SQLite/DB storage now: JSON files suffice for one local user; revisit with concurrency.

## Known limits

- An interrupted step is re-run; non-idempotent side effects inside it may repeat.
- Budget is enforced between steps, not mid-step (one step ≤ 8 Claude turns).
- Audit file is not tamper-proof; single user only; no authentication yet.

## Setup

```bash
npm install
node src/cli.ts project add <path>
node src/cli.ts run "<goal>" --project <id> --write --budget 200000
```
