# ADR 0001 — Core slice 1: TypeScript CLI with agent-CLI adapters

Status: accepted (2026-10-16, agreed with the user). Branch: `feature/core-slice`.

## Context

The first core slice needs one local project, a restart-safe task, one agent adapter, project-scoped MCP file tools with deterministic permission checks and audit, a budget pause and a minimal UI. The user wants hosted agents that run on existing subscriptions, not paid APIs, and any agent assignable to any role later ([routing-001](../../features/model-routing/SPEC.md#role-and-agent-assignments)).

## Decision

- **Language/runtime:** TypeScript on Node ≥ 24, run directly via Node type stripping (no build step); `tsc` only typechecks. Chosen for first-class MCP and Claude Agent SDKs and one language for later desktop/browser work. Python stays an option for later ML-heavy services.
- **UI:** CLI (`node src/cli.ts`, run from `app/`).
- **Adapters are agent products, not models.** `AgentAdapter.step()` runs one bounded step and reports usage. First adapter: Claude Code in print mode (`claude -p --output-format json`) with all built-in tools disabled (`--tools ""`) and only the workspace MCP server allowed (`--strict-mcp-config --allowedTools mcp__ws`), so every file access passes through the broker. Settings isolation: `--setting-sources ""` so user/project settings, hooks, rules and model aliases cannot steer a task (found in e2e: user CLAUDE.md rules hijacked the agent; a user model alias broke model selection). An optional per-role `model` maps to `--model`. Up to 8 turns per step; `--resume` continues the CLI session as a hint only — durable state is the workspace task file.
- **Orchestrator adapter:** Codex CLI (`codex exec --json`) signed in with the user's ChatGPT subscription, in a dedicated `CODEX_HOME` (`~/.ai-workspace/codex`, one-time `codex login`) because `~/.codex/AGENTS.md` otherwise steers tasks and `--ignore-user-config` skips only `config.toml`. Shell, `unified_exec`, subagents, browser/computer/apps and web search are disabled; code-mode `exec` must stay on because MCP tools are reachable only through it; `-s read-only` blocks its `apply_patch`; only the `ws` server's tools are auto-approved (the broker decides). On Windows the npm `.cmd` shim is bypassed by running `codex.js` with node. One step = one `codex exec` turn. The ChatGPT app/agent UI is not automated (no programmatic interface; browser automation is fragile and may breach terms). Browser-only planning remains a manual handoff (`manual-browser`).
- **Delegation:** broker MCP tool `delegate(goal, role=Implementation)` runs a child task synchronously under the role's adapter. The child inherits project and write grant (never more), gets at most the parent's remaining token budget, and its usage is charged to the parent. Depth 1 (subtasks cannot delegate). Same parent+goal reuses the existing child, so a resumed parent does not redo completed work. MCP tool timeouts raised to 1 h.
- **Roles:** `~/.ai-workspace/roles.json` maps role → integration over defaults (`ArchitectureReasoning→manual-browser`, `Orchestration→codex`, `Implementation→claude-code`). Integrations without an adapter fail explicitly.
- **State:** workspace home (`AI_WORKSPACE_HOME`, default `~/.ai-workspace`) outside projects, because project content is untrusted for privilege decisions. Tasks are JSON written atomically (temp + rename); audit is append-only JSONL.
- **Budget:** token budget (input incl. cache + output), checked before each step. Subscription agents give token counts but no real per-call price; provider-reported cost is shown as an estimate only.

## Rejected

- ChatGPT web UI via embedded Chromium as orchestrator: no usage data, fragile, terms risk.
- OpenAI/Anthropic paid APIs first: user prefers subscriptions.
- SQLite/DB storage now: JSON files suffice for one local user; revisit with concurrency.

## Known limits

Recovery and budget design: an interrupted step is re-run; the broker effect ledger (`tasks/<id>.effects.jsonl`, key = step + tool + input hash + occurrence in the attempt) skips effects the interrupted attempt already committed. Budget is checked before each step and every broker tool call against committed usage (incl. children) plus the running step's live usage (`tasks/<id>.live.json`); a step stopped for budget ends `paused`, and a killed attempt's live usage is charged before re-run.

Open limits are tracked as GitHub issues labelled [`known-limit`](https://github.com/MomSesImSpcl/ai-workspace/issues?q=label%3Aknown-limit): turn overshoots budget [#1](https://github.com/MomSesImSpcl/ai-workspace/issues/1), crash between effect and ledger record [#2](https://github.com/MomSesImSpcl/ai-workspace/issues/2), no Codex mid-turn usage [#3](https://github.com/MomSesImSpcl/ai-workspace/issues/3), sequential delegation [#4](https://github.com/MomSesImSpcl/ai-workspace/issues/4), audit not tamper-proof [#5](https://github.com/MomSesImSpcl/ai-workspace/issues/5), single user without auth [#6](https://github.com/MomSesImSpcl/ai-workspace/issues/6), project CLAUDE.md can steer the agent [#7](https://github.com/MomSesImSpcl/ai-workspace/issues/7), Codex apply_patch sandbox unexercised [#8](https://github.com/MomSesImSpcl/ai-workspace/issues/8), no fallback when `--resume` fails [#9](https://github.com/MomSesImSpcl/ai-workspace/issues/9), real-agent runs Windows-only [#10](https://github.com/MomSesImSpcl/ai-workspace/issues/10).

## Setup

See [Getting started](../../../README.md#getting-started-prototype-cli).
