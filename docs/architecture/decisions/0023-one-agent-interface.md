# ADR 0023: One agent interface, code over instruction text

## Status

accepted 2026-10-23 (user); not implemented. Amends [ADR 0006](0006-agent-capability-contract.md). Principles 11 and 12 in [PRINCIPLES.md](../../PRINCIPLES.md).

## Context

Reading every instruction the workspace sends showed about eight pairs of Claude Code and Codex versions of the same rule that differ only in wording or tool naming, a prompt assembled separately in each adapter, and features only one agent gets (the effort note, the workspace tools in Codex subtasks, the write guard's refusal text). The user once gave Codex an instruction that only worked for Claude Code. Many rules are also prose an agent can ignore or read differently, where the workspace could enforce the same thing in code.

## Decision

- **One interface:** every agent integration implements one shared adapter interface: deliver the instructions, attach the workspace tools, map tool names, report capabilities. The workspace builds one set of instructions and tools for all agents; adapters add no rule text.
- **Same tools for every agent:** every role and agent gets the same workspace tools and lookups under neutral names; an agent that does not need one does not call it. Something one agent needs is added to the interface for all.
- **Capability gaps:** where an agent lacks a mechanism, the workspace provides it itself where it can (refusals as tool results rather than hook text), or applies one shared fallback ([ADR 0006](0006-agent-capability-contract.md)); otherwise the feature is off for that agent and Settings says so.
- **Code over text:** rules the workspace can enforce become tool schemas, required parameters, defaults, validation or fixed output; instruction text keeps only judgment (routing a message, writing a good goal, when to ask back).
- **Order (user, 2026-10-23):** first the unified interface and instruction builder, then capability parity, then turning rules into schemas and code, then editing in the Agent instructions tab.

## Rejected alternatives

- Per-agent rule sets kept in sync by hand: they drift and send one agent's instructions to another.
- Telling an agent to ignore parts meant for another: the text still costs tokens and can still be followed.

## Consequences

- Adapters shrink to delivery and capability mapping; a new agent implements the interface instead of copying prompts.
- Existing agent-specific texts and code paths are migration work, done in the iterations above, each with its own spec.
