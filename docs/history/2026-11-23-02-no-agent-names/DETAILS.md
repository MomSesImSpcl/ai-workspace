# 2026-11-23: no agent named in instruction text

**Scope:** [agent-interface-003](../../features/agent-interface/SPEC.md#requirements). Effort: medium.

**Outcome:**
- `app/src/setup.ts`: `setupStatus` adds `builtInTools`, the ids of the agent's built-in tool items; `requiresBuiltInTool` is derived from it.
- `app/src/sessions.ts`: the orchestrator note says "ensure at least one of the agent's builtInTools is enabled (in alwaysOn or passed in setup)" instead of naming Claude Code's and Codex's ids.
- `app/src/tasks.ts`, `app/src/approval-server.ts`: the no-built-in-tool refusal no longer names the agent and points to `setupStatus.builtInTools`; the list_agents description mentions `builtInTools`. Catalog copies in `app/src/instructions.ts` follow.
- An agent id filled into a placeholder (the chosen agent in a start_task reply, unknown setup items for an agent) stays: it is data.

**Checks:** `npm run typecheck` clean; `npm test` 117/117 on Windows, with the new catalog scan for agent names in `app/test/instructions.test.ts` and a `builtInTools` check in `app/test/tasks.test.ts`.

**Not done:** the Glob setup-item description that hides folders (next); real-agent run with an orchestrator choosing tools.

**Branch:** `agent-instructions` (this worktree), committed locally, not pushed.
