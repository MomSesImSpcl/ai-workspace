# Integration matrix

How each supported agent and version-control system implements the workspace's capabilities. Use it to see what adding or extending an integration costs: every row an integration cannot fill needs adapter work or a documented limit. Installation and tested versions are in the [dependency inventory](DEPENDENCIES.md). Update a cell whenever work changes how an integration provides a capability, and link the evidence.

Status: **built** (implemented and tested), **planned** (specified, mechanism known), **verify** (mechanism assumed, not yet confirmed), **n/a** (does not apply).

## Agents

Contracts: [AgentAdapter](../app/src/runtime.ts), sessions event contract ([sessions-020](features/sessions/SPEC.md#permissions-events-and-recovery)), [ADR 0004](architecture/decisions/0004-agent-native-permissions.md).

| Capability | Claude Code CLI | Codex CLI |
|---|---|---|
| Run one turn headless | built: `claude -p --output-format stream-json` | built: `codex exec --json` |
| Continue a conversation | built: `--resume <session id>` | built: conversation sent as text each turn; native thread resume: verify |
| Streamed reply text and activity events (sessions-007/020) | planned: `stream-json` assistant and tool events (today used only for live usage) | planned: `--json` item events (agent message, command, file change) |
| Live usage while running | built: per-message usage from the stream | planned: usage arrives at turn end (`turn.completed`); mid-turn: verify |
| Stop a turn (sessions-010) | planned: end the process | planned: end the process |
| Own tools, settings and permissions (ADR 0004) | planned: drop `--tools ''`, `--setting-sources ''`, `--strict-mcp-config` | planned: drop `--ignore-user-config`, `--ignore-rules`, `-s read-only`, dedicated `CODEX_HOME` |
| Read effective permissions for the summary (sessions-018) | verify: user/project settings files (`permissions` allow/ask/deny) | verify: config `approval_policy` and sandbox mode |
| Relay "ask" prompts as approval cards (sessions-019) | verify: `--permission-prompt-tool` (MCP tool answering allow/deny) | verify: approval requests in the exec protocol |
| Global rules file (sessions-016) | user `CLAUDE.md`, loaded natively | user `AGENTS.md`, loaded natively |
| Provider usage/rate limit detection (sessions-024) | verify: limit error in result event | verify: error event text |
| Delegate to a child task (workspace `delegate` tool) | built: workspace MCP server | built: workspace MCP server |

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

Add a column, fill every row with a status and the mechanism or the reason it cannot be supported, and open `known-limit` issues for rows that stay unsupported.
