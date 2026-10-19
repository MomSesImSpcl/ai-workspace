# Configurable orchestration, agent roles and context delegation

**Status:** in-progress: orchestrator chat runs every change as a task, replies to its tasks, picks agent, model and effort with an override (orchestrator-004, 006; ADR 0011); lean setup per run (orchestrator-005, ADR 0012); user rules for decided setup items and lean Chat sessions specified, not built (orchestrator-008, 009); planning handoff and compatibility checks not built

Choose compatible planning/design, orchestration and implementation agents independently, locally or through hosted services. The orchestrator selects agents and supported effort, gathers authorized context and constructs inspectable requests. Preserve plans and results across role handoffs, respect manual overrides and fixed-context choices, and leave authority enforcement to deterministic services. Browser planning supports controlled manual transfer; named products are examples whose integration support must be verified.

[Full requirements](SPEC.md).

Hermes-specific qualification is tracked separately in [Hermes Agent and Hindsight evaluation and integration](../hermes-hindsight/SUMMARY.md); no product has been selected.

**Dependencies / related features:** [model-routing](../model-routing/SUMMARY.md), [knowledge-retrieval](../knowledge-retrieval/SUMMARY.md), [skills](../skills/SUMMARY.md), [task-runtime](../task-runtime/SUMMARY.md), optional [integrated-browser](../integrated-browser/SUMMARY.md).
