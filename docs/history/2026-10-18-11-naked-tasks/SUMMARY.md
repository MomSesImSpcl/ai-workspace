# Naked tasks

After testing the lean setup in the app, the user decided that tasks run naked: the orchestrator picks everything a task uses ([ADR 0012](../../architecture/decisions/0012-lean-agent-setup-per-run.md), orchestrator-005). Built-in tools, the agent's own system prompt and the workspace's `delegate` tool became setup items. A chat's task with no built-in tool is refused. A task that finds an item missing calls `request_setup`; the request shows in the task and its chat, and the task continues with the item in a new process.

Prompt tokens per call, real runs with the user's setup:

| | before (history 10) | after |
|---|---|---|
| Claude Code orchestrator | 11,974 | 8,929 |
| Claude Code task (only Read picked) | 42,307 | 6,341 |
| Codex orchestrator | 16,509 | 6,598 |
| Codex task (nothing picked) | 17,281 | 7,297 |

Tests 49/49. See [details](DETAILS.md).
