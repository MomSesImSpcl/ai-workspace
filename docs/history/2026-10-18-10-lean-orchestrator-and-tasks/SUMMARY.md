# Lean orchestrator and tasks

Built orchestrator-005 and onboarding-010 ([ADR 0012](../../architecture/decisions/0012-lean-agent-setup-per-run.md)), milestone M1. Orchestrator chats and tasks load only chosen items, switched for each run. Each agent's plugins, MCP servers, apps, standalone skills and hooks are listed without a model call. Settings sets each item per role and agent: always on, orchestrator decides, or off. The orchestrator role defaults to off. The user's global rule files load per role, default off. The workspace folder's AGENTS.md is added. The orchestrator gets only reading tools. Closes #16.

Prompt tokens per call, real runs with the user's setup:

| | Claude Code before | after | Codex before | after |
|---|---|---|---|---|
| Orchestrator chat | 74,099 | 11,974 | 21,484 | 16,509 |
| Task, nothing picked | 79,349 | 42,307 | 22,314 | 17,281 |

Tests 49/49, typecheck clean. See [details](DETAILS.md).
