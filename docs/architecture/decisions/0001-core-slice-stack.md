# ADR 0001 — Core slice 1: TypeScript CLI with agent-CLI adapters

Status: accepted (2026-10-16, agreed with the user). Branch: `feature/core-slice`.

## Context

The first core slice needs one local project, a restart-safe task, one agent adapter, project-scoped MCP file tools with deterministic permission checks and audit, a budget pause and a minimal UI. The user wants hosted agents that run on existing subscriptions, not paid APIs, and any agent assignable to any role later ([routing-001](../../features/model-routing/SPEC.md#role-and-agent-assignments)).

## Decision

- **Language/runtime:** TypeScript on Node ≥ 24, run directly via Node type stripping (no build step); `tsc` only typechecks. Chosen for first-class MCP and Claude Agent SDKs and one language for later desktop/browser work. Python stays an option for later ML-heavy services.
- **UI:** CLI (`node src/cli.ts`).
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

- An interrupted step is re-run. The broker's effect ledger (`tasks/<id>.effects.jsonl`, key = step + tool + input hash + occurrence in the attempt) skips side effects the interrupted attempt already committed, in order; a crash between an effect and its ledger record can still repeat that one effect.
- Budget is checked before each step and before every broker tool call, against committed usage (incl. delegated children) plus the running step's live usage (`tasks/<id>.live.json`, streamed by Claude Code; Codex reports usage only at turn end). A step the broker stopped for budget ends `paused`. One model turn can still overshoot, since its tokens are known only after it. A killed attempt's live usage is charged before the step re-runs.
- A target project's own `CLAUDE.md` may still be auto-discovered; it can steer behavior but not widen tool scope (broker enforces).
- Codex: the read-only sandbox block of `apply_patch` is not directly exercised (the model declined a bypass attempt; no file was written). Codex tool surface changes between versions (tested 0.163.0); re-verify on upgrade.
- Delegation is sequential and blocking; no parallel children, no child cancel from the parent yet.
- Audit file is not tamper-proof; single user only; no authentication yet.

## Setup

```bash
npm install
node src/cli.ts project add <path>
node src/cli.ts run "<goal>" --project <id> --write --budget 200000
```
