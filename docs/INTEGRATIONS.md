# Integration matrix

How each supported agent and version-control system implements the workspace's capabilities. Use it to see what adding or extending an integration costs: every row an integration cannot fill needs adapter work or a documented limit. Installation and tested versions are in the [dependency inventory](DEPENDENCIES.md). Update a cell whenever work changes how an integration provides a capability, and link the evidence.

Status: **built** (implemented and tested), **planned** (specified, mechanism known), **checked** (mechanism confirmed against the real tool, not yet implemented), **verify** (mechanism assumed, not yet confirmed), **n/a** (does not apply).

Codex findings (codex-cli 0.163.0, Windows 10, 2026-10-17, [history](history/2026-10-17-09-codex-capability-check/SUMMARY.md)): `codex exec --json` only emits completed items and turn-end usage and cannot ask for approvals. The `codex app-server` protocol (marked experimental) covers streaming, approvals, interrupt, resume, live usage, rate limits and config reads according to its protocol schema (`codex app-server generate-json-schema`; not yet exercised in a real session), so the Codex adapter for sessions should move to it.

Claude Code findings (2.1.301, Windows 10, 2026-10-17, [history](history/2026-10-17-10-claude-code-capability-check/SUMMARY.md)): approval relay, rate-limit events and the `init` event's permission mode and loaded rule files were confirmed in real `claude -p` runs; allow/ask/deny rules are not reported and must be read from the settings files.

## Agents

Contracts: [AgentAdapter](../app/src/runtime.ts), sessions event contract ([sessions-020](features/sessions/SPEC.md#permissions-events-and-recovery)), [ADR 0004](architecture/decisions/0004-agent-native-permissions.md).

| Capability | Claude Code CLI | Codex CLI |
|---|---|---|
| Run one turn headless | built: `claude -p --output-format stream-json` | built: `codex exec --json` |
| Continue a conversation | built: `--resume <session id>` | built: conversation sent as text each turn; checked: `codex exec resume <thread id> <prompt>` keeps the thread (real run recalled the earlier turn); app-server `thread/resume` |
| Streamed reply text and activity events (sessions-007/020) | built (sessions): `--include-partial-messages` text deltas, `assistant` `tool_use` and `user` `tool_result` events mapped to the event contract | checked: `exec --json` emits only `item.completed` (no deltas, and a rejected command produced no item); app-server streams `item/agentMessage/delta`, `item/started`/`item/completed`, command and file-change output deltas |
| Live usage while running | built: per-message usage from the stream | checked: `exec` reports usage only at `turn.completed`; app-server sends `thread/tokenUsage/updated` |
| Stop a turn (sessions-010) | built (sessions): end the process tree | built (sessions): end the process tree (`exec`); checked: app-server `turn/interrupt` keeps the thread |
| Own tools, settings and permissions (ADR 0004) | built for sessions (tasks still restricted) | built for sessions: user config, rules and `CODEX_HOME` (tasks still restricted) |
| Read effective permissions for the summary (sessions-018) | built: `init` `permissionMode` plus user, project and local settings files merged (managed settings not read) | built (regex on `config.toml`): `approval_policy` and `sandbox_mode`; app-server `config/read` later |
| Relay "ask" prompts as approval cards (sessions-019) | built (sessions, `app/src/approval-server.ts`; real Allow and Deny runs): `--permission-prompt-tool <mcp tool>` receives `tool_name` and `input` for every "ask"; answering `{"behavior":"deny","message":…}` blocks the call, the agent continues, and the result lists it in `permission_denials` (real run with an "ask" rule on Write); `--permission-prompts none` would deny silently instead | checked: not possible with `exec` (with `approval_policy="never"` a blocked command is silently denied, seen in a real run); app-server requests `item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, `item/permissions/requestApproval` |
| Own plugins, skills, hooks, MCP servers load and are reported (sessions-025) | built: loaded natively; `init` reports `plugins`, `mcp_servers` with status and `skills`, shown in the session | loaded natively from the user's `~/.codex`; not reported by `exec` (app-server later) |
| Global rules file (sessions-016) | checked: user `CLAUDE.md` loads even with `--setting-sources project` (the real run followed a global rule), listed in `init.memory_paths` | user `AGENTS.md`, loaded natively |
| Provider usage/rate limit detection (sessions-024) | checked: `rate_limit_event` in the stream with status, limit type, per-window utilization and `resetsAt` (five-hour and seven-day windows); the event at an actually exceeded limit was not observed | checked: app-server `account/rateLimits/read` and `account/rateLimits/updated`; in `exec` only error text, reported by users as "You've hit your usage limit. Try again at <time>" or with an upgrade hint instead of a time (not tested; JSON event shape unknown), so detection should use the app-server events |
| Check a tool call before it runs and ask (repeat detection, runtime-004; fallback per ADR 0006: detect from events, stop, pause) | checked: `PreToolUse` hook answering "ask" routes to `--permission-prompt-tool` | verify: Codex hooks (`hooks.json`) or app-server approval requests |
| Permission mode per task (runtime-003) | planned: `--permission-mode` | verify: app-server approval policy and sandbox per turn |
| Delegate to a child task (workspace `delegate` tool) | built: workspace MCP server | built: workspace MCP server |
| Writes in the project folder on Windows | built (through the broker today) | checked (cause inferred): the dedicated `CODEX_HOME` has no `config.toml`, and `codex doctor` reports "sandbox backend: disabled". Without a Windows sandbox, writes cannot run sandboxed and need approval, which `approval_policy="never"` rejects ("blocked by policy"). Fix: configure `windows.sandbox` (`elevated` or `unelevated`, or MXC via `features.prefer_mxc`) in the Codex config the workspace uses, or relay approvals via app-server |

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

Rows are the required agent capabilities ([ADR 0006](architecture/decisions/0006-agent-capability-contract.md)). Add a column and fill every row with a status and the native mechanism, the fallback the row names, or the reason it cannot be supported. Open `known-limit` issues for rows on a fallback or unsupported, and show the limit in the session or task. Run the conformance check: the shared per-capability tests against the adapter's event mapping, with recorded real CLI output as fixtures, plus the real-run checklist recorded in history. A feature that needs a new agent capability adds a row here.
