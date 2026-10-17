# Durable autonomous tasks and context continuation

**Status:** in-progress: agent-native tasks built as background sessions (4.7, runtime-001–005; ADR 0007, ADR 0009): token cap and cancel by process, approvals, permission mode, repeat detection, child tasks; context rollover, scheduling and parallel children not started

Run independent background tasks alongside responsive conversations. Persist work graphs, evidence, checkpoints, budgets and controls; support context rollover, safe recovery, child tasks, model handoffs and capacity-aware scheduling.

[Full requirements](SPEC.md).

**Dependencies / related features:** [identity-projects](../identity-projects/SUMMARY.md), [model-routing](../model-routing/SUMMARY.md), [runners](../runners/SUMMARY.md), [tool-broker](../tool-broker/SUMMARY.md), [sessions](../sessions/SUMMARY.md) (interactive sessions per project).
