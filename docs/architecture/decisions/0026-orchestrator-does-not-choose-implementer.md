# ADR 0026: The orchestrator does not choose the implementer

## Status

accepted 2026-11-23 (user), implemented 2026-11-23. Amends [ADR 0011](0011-orchestrator-works-through-tasks.md) and [orchestrator-004](../../features/ai-orchestrator/SPEC.md#requirements).

## Context

start_task let the orchestrator pass an agent, a model and a role, first guarded by a rule in its note and then by an `override` flag. The user decided this goes against the workspace's design: which agent implements is the user's setting, not the orchestrator's choice.

## Decision

- start_task has no agent, model, role or override parameter. Every task a chat starts runs in the Implementation role on the agent and model set in Settings → Agents.
- The orchestrator still decides what depends on that implementer: effort (from its model's catalog), setup items, permission mode, title, reason, cap and basedOn.
- list_agents describes only that implementer: agent, model, default effort, its models with their effort levels, its permission modes and its setup items.
- The user can still change one task's agent, model or effort with Change.

## Consequences

- The orchestrator note and tool descriptions need no rule about keeping the configured agent; the schema cannot express another.
- A user who wants another agent for one piece of work changes the task with Change, or the Implementation role in Settings.
