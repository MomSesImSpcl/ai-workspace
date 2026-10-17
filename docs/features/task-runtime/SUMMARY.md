# Durable autonomous tasks and context continuation

**Status:** in-progress: restart-safe tasks, token budget, child tasks (core slice 1); agent-native tasks specified (4.7, ADR 0007), not started

Run independent background tasks alongside responsive conversations. Persist work graphs, evidence, checkpoints, budgets and controls; support context rollover, safe recovery, child tasks, model handoffs and capacity-aware scheduling.

[Full requirements](SPEC.md).

**Dependencies / related features:** [identity-projects](../identity-projects/SUMMARY.md), [model-routing](../model-routing/SUMMARY.md), [runners](../runners/SUMMARY.md), [tool-broker](../tool-broker/SUMMARY.md), [sessions](../sessions/SUMMARY.md) (interactive sessions per project).
