# ADR 0013 — Three roles: Chat, Orchestration, Implementation

Status: accepted (2026-10-19, chosen by the user); implemented 2026-10-19. Supersedes the `ArchitectureReasoning→manual-browser` default of [ADR 0001](0001-core-slice-stack.md) and the design role of [ADR 0012](0012-lean-agent-setup-per-run.md)'s global-rules switch.

## Decision

- The workspace has three roles, shown in this order: **Chat** (plain chat sessions, and the agent of new sessions), **Orchestration** (orchestrator chats) and **Implementation** (tasks).
- The separate planning/design role `ArchitectureReasoning` is dropped. Planning happens in the chat or the orchestrator chat, later in Plan Mode ([orchestrator-007](../../features/ai-orchestrator/SPEC.md)). Its one use, planning with a stronger model than the chat, is covered by Plan Mode's option B as a setting.
- Each role names an agent, a default model and a default effort from the agent's catalog ([onboarding-008](../../features/onboarding/SPEC.md#requirements)), plus optional user instructions added to that role's agent.
- Only integrations with a runnable agent can be assigned. `manual-browser` returns when its [browser handoff](../../features/integrated-browser/SPEC.md#planning-role-handoff) is built.

Clarification (2026-10-21): implementation tasks inherit the current Implementation agent and model unless the user explicitly overrides them. Setup availability is not authority to substitute another integration; request missing setup or report a blocker. See [verification](../../history/2026-10-21-06-configured-implementer/DETAILS.md).

## Consequences

- A role saved earlier under `ArchitectureReasoning` in `roles.json` is ignored; its global-rules switch is gone.
- An unknown role, agent, model or effort is refused by the API instead of being stored.
