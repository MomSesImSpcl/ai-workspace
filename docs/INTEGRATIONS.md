# Integration matrix

How each supported agent and version-control system implements the workspace's capabilities. Use it to see what adding or extending an integration costs: every row an integration cannot fill needs adapter work or a documented limit. Installation and tested versions are in the [dependency inventory](DEPENDENCIES.md). Update a cell whenever work changes how an integration provides a capability, and link the evidence.

Status: **built** (implemented and tested), **planned** (specified, mechanism known), **checked** (mechanism confirmed against the real tool, not yet implemented), **verify** (mechanism assumed, not yet confirmed), **n/a** (does not apply).

Codex findings (codex-cli 0.163.0, Windows 10, 2026-10-17, [history](history/2026-10-17-09-codex-capability-check/SUMMARY.md)): `codex exec --json` only emits completed items and turn-end usage and cannot ask for approvals. The `codex app-server` protocol (marked experimental) covers streaming, approvals, interrupt, resume, live usage, rate limits and config reads according to its protocol schema (`codex app-server generate-json-schema`; not yet exercised in a real session), so the Codex adapter moved to it ([ADR 0009](architecture/decisions/0009-tasks-are-sessions.md); real runs: [history](history/2026-10-17-40-agent-native-tasks/SUMMARY.md)).

Claude Code findings (2.1.301, Windows 10, 2026-10-17, [history](history/2026-10-17-10-claude-code-capability-check/SUMMARY.md)): approval relay, rate-limit events and the `init` event's permission mode and loaded rule files were confirmed in real `claude -p` runs; allow/ask/deny rules are not reported and must be read from the settings files.

## Agents

Contracts: [SessionAgent and AgentProcess](../app/src/sessions.ts), sessions event contract ([sessions-020](features/sessions/SPEC.md#permissions-events-and-recovery)), [ADR 0004](architecture/decisions/0004-agent-native-permissions.md).

| Capability | Claude Code CLI | Codex CLI |
|---|---|---|
| Run one turn headless | built: one long-lived `claude -p --input-format stream-json --output-format stream-json` process per session or task, one user message per turn ([ADR 0008](architecture/decisions/0008-session-host-process.md)) | built: one long-lived `codex app-server` process per session or task, `turn/start` per message ([ADR 0009](architecture/decisions/0009-tasks-are-sessions.md)) |
| Continue a conversation | built: `--resume <session id>`; a gone session starts fresh from workspace history | built: app-server `thread/resume` by thread id; a gone thread starts fresh from workspace history |
| Streamed reply text and activity events (sessions-007/020) | built: `--include-partial-messages` text deltas, `assistant` `tool_use` and `user` `tool_result` events mapped to the event contract | built: `item/agentMessage/delta`, `item/started`/`item/completed` for commands, file changes and MCP calls |
| Live usage while running | built: per-message usage from the stream, used for the task cap | built: `thread/tokenUsage/updated` per model call, used for the task cap |
| Stop a turn (sessions-010) | built: `control_request` `interrupt` on stdin, process kept; ends the process tree if no result in 10 s; task cancel and cap end the process tree at once | built: `turn/interrupt`, thread kept; ends the process tree if no result in 10 s; task cancel and cap end it at once |
| Own tools, settings and permissions (ADR 0004) | built for sessions and tasks | built for sessions and tasks: the user's own `~/.codex` config, rules and sign-in |
| Read effective permissions for the summary (sessions-018) | built: `init` `permissionMode` plus user, project and local settings files merged (managed settings not read) | built (regex on `config.toml`): `approval_policy` and `sandbox_mode`; app-server `config/read` later |
| Relay "ask" prompts as approval cards (sessions-019, runtime-002) | built (`app/src/approval-server.ts`, MCP server `aiws`; real Allow and Deny runs): `--permission-prompt-tool <mcp tool>` receives `tool_name` and `input` for every "ask"; answering `{"behavior":"deny","message":…}` blocks the call and the agent continues. An `--mcp-config` server named `workspace` is dropped silently | built (real run): `item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, `item/permissions/requestApproval` become cards; the answer is sent when the user decides |
| Own plugins, skills, hooks, MCP servers load and are reported (sessions-025) | built: loaded natively; `init` reports `plugins`, `mcp_servers` with status and `skills`, shown in the session | built: loaded natively from the user's `~/.codex`; thread start reports model, approval policy, sandbox and instruction files, `mcpServer/startupStatus/updated` the MCP servers |
| Agent notices: warnings shown in the agent's own UI, e.g. a hook that dropped the prompt (sessions-020) | built: `system`/`informational` events (`content`, `prevent_continuation`) become `notice` events shown in the turn; plugin state survives between turns with the long-lived process ([#15](https://github.com/MomSesImSpcl/ai-workspace/issues/15), ADR 0008) | verify: app-server notifications |
| Global rules file (sessions-016) | checked: user `CLAUDE.md` loads even with `--setting-sources project` (the real run followed a global rule), listed in `init.memory_paths` | user `AGENTS.md`, loaded natively |
| Provider usage/rate limit detection (sessions-024) | checked: `rate_limit_event` in the stream with status, limit type, per-window utilization and `resetsAt` (five-hour and seven-day windows); the event at an actually exceeded limit was not observed | checked: app-server `account/rateLimits/read` and `account/rateLimits/updated`; in `exec` only error text, reported by users as "You've hit your usage limit. Try again at <time>" or with an upgrade hint instead of a time (not tested; JSON event shape unknown), so detection should use the app-server events |
| Check a tool call before it runs and ask (repeat detection, runtime-004; fallback per ADR 0006: detect from events, stop, pause) | built (real run, also under `bypassPermissions`): `PreToolUse` hook from `--settings` answers "ask", the card is labelled as a possible repeat | built fallback (real run): a matching `item/started` ends the process and pauses the task; compares the command text Codex reports |
| Permission mode per task (runtime-003) | built: `--permission-mode` (manual, acceptEdits, auto, plan, dontAsk, bypassPermissions) | built: thread approval policy and sandbox presets (read-only, auto, full access) |
| Load only chosen plugins, skills and MCP servers for one run (orchestrator-005, onboarding-010) | checked (2026-10-18): `--disallowedTools mcp__<server>` drops one MCP server or claude.ai connector from the prompt (90,465 to 74,066 tokens for three Google connectors); `--strict-mcp-config` drops all; `--settings` with `enabledPlugins` false switches a plugin and its skills off for the run; `--disable-slash-commands` drops every skill (no per-skill switch found); `--setting-sources project` drops user settings and their hooks; floor about 35k tokens; single standalone skills only through the app's persistent skill settings (`Skill(<name>)` deny leaves them in the prompt); global rule files off not yet checked | checked (2026-10-18): `plugin/list` and `skills/list` list every item with description, `enabled` and owning plugin; per run, `disabledPluginIds` on `turn/start` drops plugins and their skills, `mcp_servers.<name>.enabled=false` and `skills.config` entries in thread `config` drop single MCP servers and skills; fixed prompt 22k full, about 18k with everything off |
| Model and effort catalog (onboarding-008, sessions-015) | built: user's default from settings plus the documented aliases (fable, opus, sonnet, haiku), efforts low–max for each | built: `codex debug models` (hidden models left out, per-model reasoning levels, configured default), cached 10 min |
| Delegate to a child task (workspace `delegate` tool) | built (real run): `mcp__aiws__delegate`, allowed without a card | built (real run): `mcp_servers.aiws` in the thread config |
| Writes in the project folder on Windows | built: the agent's own tools and permission rules | built (real run): the user's Codex sandbox; writes outside it arrive as approval cards |

## Version control

Contract: provider interface ([vcs-010](features/version-control/SPEC.md#requirements)). Order agreed: Git, then Git LFS, then others on demand.

| Capability | Git | Git LFS | Others (e.g. Perforce) |
|---|---|---|---|
| Clone / check out (vcs-001) | planned: `git clone` | planned: `git lfs` must be installed; pull LFS objects | not started |
| Status, changes, diff (vcs-002) | planned | planned: show pointer vs content | not started |
| Commit, pull, push (vcs-003/004) | planned | planned | not started |
| History, branches (vcs-005/006) | planned | n/a (Git handles it) | not started |
| Credentials (vcs-009) | the user's Git credential helper / SSH keys | same as Git | the system's own login |
| Turn-start state for recovery (sessions-021) | planned: `HEAD` + `git status --porcelain` | same as Git | not started |
| Browse remote repositories (vcs-012) | later: GitHub via its own sign-in | n/a | not started |

## Adding an integration

Rows are the required agent capabilities ([ADR 0006](architecture/decisions/0006-agent-capability-contract.md)); later, users add tools themselves through a guided onboarding that fills these rows ([custom-integrations](features/custom-integrations/SPEC.md)). Add a column and fill every row with a status and the native mechanism, the fallback the row names, or the reason it cannot be supported. Open `known-limit` issues for rows on a fallback or unsupported, and show the limit in the session or task. Run the conformance check: the shared per-capability tests against the adapter's event mapping, with recorded real CLI output as fixtures, plus the real-run checklist recorded in history. A feature that needs a new agent capability adds a row here.
