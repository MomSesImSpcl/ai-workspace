# ADR 0012 — Orchestrator chats and tasks load a chosen setup, switched per run

Status: accepted (2026-10-18, chosen by the user); implemented 2026-10-18. Narrows [ADR 0004](0004-agent-native-permissions.md) and [runtime-001](../../features/task-runtime/SPEC.md#47-agent-native-tasks) for orchestrator chats and tasks; implements [orchestrator-005](../../features/ai-orchestrator/SPEC.md#independently-selectable-roles) and [onboarding-010](../../features/onboarding/SPEC.md#requirements).

## Decision

- The workspace lists what each agent loads (plugins, MCP servers, apps, standalone skills as one item, hooks) from the agent's own CLI or app-server, without a model call.
- Each item has a state per role (orchestrator, implementation) and agent, set in Settings: always on, orchestrator decides, or off. The orchestrator role defaults to off, the implementation role to orchestrator decides. The orchestrator picks the decidable items a task needs with `start_task`'s `setup`.
- The user's global rule files load per role (design, orchestrator, implementation) behind a Settings switch, default off. The workspace folder's own `AGENTS.md` is added for projects inside it; project rule files always load.
- Items are switched only for the one run the workspace starts, with the agent's own flags and run config. The user's agent settings and accounts are never changed; an item without a per-run switch stays on.
- The orchestrator additionally gets only reading tools (Claude Code `--tools Read,Glob,Grep`); it can no longer reach the user's MCP servers or connectors that write (closes #16).
- Plain Chat sessions keep the user's full setup.

## Consequences

- Measured with the user's setup, prompt tokens per call: Claude Code orchestrator 74,099 to 11,974, task 79,349 to 42,307; Codex orchestrator 21,484 to 16,509, task 22,314 to 17,281.
- A task that needs an item the orchestrator did not pick fails or works without it; the orchestrator starts it again with the item added.
- Claude Code needs the user's other settings passed on when global rules are off, since its user source also carries env, plugins and hooks. A `.claude/CLAUDE.md` above the project still loads, and Codex's global `AGENTS.md` cannot be switched off for one run.
- Listing runs at every orchestrator or task start (Claude Code: a few seconds for `claude mcp list`).
