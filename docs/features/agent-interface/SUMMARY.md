# One agent interface

**Status:** in-progress: iteration one partly built (interface with derived agent list, instruction builder, capability report, no agent named in instruction text); agent-interface-004–008 not started

Every agent integration implements one shared adapter interface, and the workspace builds one set of instructions and tools per role for all agents ([ADR 0023](../../architecture/decisions/0023-one-agent-interface.md)). The instructions belong to the workspace, not to an agent: any agent with an adapter runs with the same setup, and an agent appears in Settings only where it lacks a capability. This spec covers iteration one (interface and instruction builder); capability parity, rules into code and editing follow as later iterations.

[Full requirements](SPEC.md).

**Dependencies / related features:** [agent-instructions](../agent-instructions/SUMMARY.md), [custom-integrations](../custom-integrations/SUMMARY.md), [ai-orchestrator](../ai-orchestrator/SUMMARY.md), [onboarding](../onboarding/SUMMARY.md); contract: [ADR 0006](../../architecture/decisions/0006-agent-capability-contract.md), [integration matrix](../../INTEGRATIONS.md).
