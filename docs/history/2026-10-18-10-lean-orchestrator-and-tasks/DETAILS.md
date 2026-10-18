# Lean orchestrator and tasks: details

Branch `claude/lean-agent-setup`. Claude Code 2.1.301 (haiku), codex-cli 0.163.0 (the user's default model).

## Measurement

Each figure is from a real run through the app code: `createSession` (role Orchestration) or `createTask` (role Implementation) and `runTurn`. The runs used a scratch store (`AI_WORKSPACE_HOME` in a temporary folder, never the user's storage) and this repository as the project. The message was "Reply with just the word ok", so each run made one model call. A wrapper logged the agent's arguments and stream, and the prompt tokens come from that call's usage (Claude Code: input + cache read + cache write; Codex: `thread/tokenUsage/updated` `last.inputTokens`).

What the agents loaded before:
- Claude Code: 6 plugins (cache-tax, ponytail, caveman, and three built-in `cc-plugin-*`), 59 skills, 7 MCP servers (caveman, aiws, five claude.ai connectors including GitHub and Claude Docs), 28 built-in tools for the orchestrator and 33 for a task, the user's hooks, the user's CLAUDE.md and rules, and the project's CLAUDE.md/AGENTS.md.
- Codex: 22 enabled plugins, 76 skills (30 standalone), MCP servers caveman, node_repl, codex_apps (241 app tools, GitHub among them), cua_repl (computer-use plugin) and aiws, four hooks, the global and project AGENTS.md.

Steps measured for the Claude Code orchestrator (each adds to the one before): `--strict-mcp-config` 47,429; plugins off 43,738; `--disable-slash-commands` 38,130; `--tools Read,Glob,Grep` 13,666; `disableAllHooks` 13,059; global rule files off (`--setting-sources project`) 9,777. A replaced system prompt gave 10,024; it was not adopted.

Steps measured for the Codex orchestrator: plugins off (`disabledPluginIds`) 19,255; MCP servers off 19,253; standalone skills off 17,255; `features.apps=false` 16,845; `features.codex_hooks=false` 16,450.

## Findings that shaped the build

- Claude Code `--setting-sources project,local` drops the user's CLAUDE.md and rules. It also drops their settings: env (`ANTHROPIC_BASE_URL` of a local proxy), model, plugins, hooks, and the user-scope MCP servers in `~/.claude.json`. The workspace therefore passes the user's `settings.json` with `--settings` and the user-scope servers with `--mcp-config`. A run checked that the proxy env and the plugins stayed, and that only the project rule files were listed.
- Claude Code still loads a `.claude/CLAUDE.md` in a folder above the project. When the project is under the user's home folder, this includes the user's own `~/.claude/CLAUDE.md`. A `CLAUDE.md` in the workspace folder above the git root loads, but its `@AGENTS.md` import does not. Codex reads no file above the git root. So the workspace appends the workspace folder's `AGENTS.md` for both agents.
- Codex has no per-run switch for its global `AGENTS.md` (only `CODEX_HOME`, which would also move sign-in and threads), so the global-rules switch does not apply to Codex.
- Codex `disabledPluginIds` also hides a plugin's MCP tools: with every plugin off, enabling only the computer-use plugin raised the call from 16,509 to 17,435 tokens. Its `cua_repl` server still starts, but the model does not get its tools.
- `claude plugin list --json` and `claude mcp list` list the inventory without a model call. The listing takes about 3 s because of the MCP health checks.

## Build

- `app/src/setup.ts`: item states per role and agent, the global-rules switch per role, the inventory cache in `agent-setup.json`, `runSetup`, and the workspace folder's AGENTS.md.
- `app/src/adapters/claude-code.ts`: `claudeInventory`, and per-run `--settings` (`enabledPlugins`, the forwarded user settings, the repeat hook), `--disallowedTools mcp__<server>`, `--disable-slash-commands`, `--setting-sources project,local`. The orchestrator also gets `--tools Read,Glob,Grep`.
- `app/src/adapters/codex.ts`: `inventory()` on the session's own app-server; thread `config` and `disabledPluginIds` on `turn/start`.
- `app/src/approval-server.ts`: `start_task` takes `setup`, and `list_agents` returns the decidable items per agent. The orchestrator's instructions say how to use them.
- Settings, Agent setup: a global-rules switch per role, a table per agent with a state per role, and **List again** (`/api/agent-setup`).

## Verification

- `npm test`: 49/49, including a new test for both agents. It checks the orchestrator's flags, items off by default, a picked item, an always-on item, global rules per role, the workspace AGENTS.md, the Codex thread config and `disabledPluginIds`, and that a plain chat keeps its setup. `npx tsc` reports no errors.
- After runs (same method as before): Claude Code orchestrator 11,974 and task 42,307; Codex orchestrator 16,509 and task 17,281. The Claude Code orchestrator's init listed only Read, Glob, Grep and the five workspace tools; the claude.ai connectors connect but expose no tools.

## Not done

- The real app was not run with these changes. The Settings page was not opened in the app.
- No real task was run with an item picked by the orchestrator.
