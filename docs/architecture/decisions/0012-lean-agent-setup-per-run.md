# ADR 0012 — Orchestrator chats and tasks load a chosen setup, switched per run

Status: accepted (2026-10-18, chosen by the user); implemented 2026-10-18. Narrows [ADR 0004](0004-agent-native-permissions.md) and [runtime-001](../../features/task-runtime/SPEC.md#47-agent-native-tasks) for orchestrator chats and tasks; implements [orchestrator-005](../../features/ai-orchestrator/SPEC.md#independently-selectable-roles) and [onboarding-010](../../features/onboarding/SPEC.md#requirements).

## Decision

- The workspace lists what each agent loads (plugins, MCP servers, apps, standalone skills as one item, hooks) from the agent's own CLI or app-server, without a model call.
- Each item has a state per role (orchestrator, implementation) and agent, set in Settings: always on, orchestrator decides, or off. The orchestrator role defaults to off, the implementation role to orchestrator decides. The orchestrator picks the decidable items a task needs with `start_task`'s `setup`.
- The user's global rule files load per role (design, orchestrator, implementation) behind a Settings switch, default off. The workspace folder's own `AGENTS.md` is added for projects inside it; project rule files always load.
- Items are switched only for the one run the workspace starts, with the agent's own flags and run config. The user's agent settings and accounts are never changed; an item without a per-run switch stays on.
- Tasks run naked (decided 2026-10-18): built-in tools, the agent's own system prompt and the workspace's `delegate` tool are items too, so a task gets only what its role has always on and what the orchestrator picks. A chat's task without an enabled built-in tool is refused only when the agent inventory lists `tool:*` items (currently Claude Code). Codex lists feature switches instead, including its default-on implementation shell; `list_agents.setupStatus` distinguishes the requirement and always-on items from decidable setup (clarified 2026-10-21); a running task asks for a missing item with `request_setup`, which is shown in the task and its chat, and continues with it in a new process.
- The orchestrator additionally gets only reading tools (Claude Code `Read`, `Glob`, `Grep`); it can no longer reach the user's MCP servers or connectors that write (closes #16).
- Plain Chat sessions keep the user's full setup.

## Consequences

- Measured with the user's setup, prompt tokens per call: Claude Code orchestrator 74,099 to 8,929, a task with only `Read` 79,349 to 6,341; Codex orchestrator 21,484 to 6,598, a task 22,314 to 7,297.
- A task the orchestrator equips too thinly costs an extra turn and a process restart; a task that asks for more than it needs is visible in its request's reason.
- A task that needs an item the orchestrator did not pick fails or works without it; the orchestrator starts it again with the item added.
- Claude Code needs the user's other settings passed on when global rules are off, since its user source also carries env, plugins and hooks. A `.claude/CLAUDE.md` above the project still loads, and Codex's global `AGENTS.md` cannot be switched off for one run.
- Listing runs at every orchestrator or task start (Claude Code: a few seconds for `claude mcp list`).
