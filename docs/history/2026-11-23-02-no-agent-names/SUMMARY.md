# No agent named in instruction text (agent-interface-003)

The orchestrator note no longer lists Claude Code's `tool:*` ids or Codex's shell item: `list_agents` reports each agent's built-in tool items as `setupStatus.builtInTools`, and the note only says to enable one of them. The start_task refusal and the list_agents description are neutral too. A test fails when any catalog text names an agent. Typecheck clean, tests 117/117; not yet tried with real agents.

[Details](DETAILS.md).
