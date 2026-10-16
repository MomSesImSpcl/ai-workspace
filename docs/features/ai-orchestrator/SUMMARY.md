# Configurable orchestration, agent roles and context delegation

**Status:** in-progress: orchestrator delegates to Implementation via broker (core slice 1)

Choose compatible planning/design, orchestration and implementation agents independently, locally or through hosted services. The orchestrator selects agents and supported effort, gathers authorized context and constructs inspectable requests. Preserve plans and results across role handoffs, respect manual overrides and fixed-context choices, and leave authority enforcement to deterministic services. Browser planning supports controlled manual transfer; named products are examples whose integration support must be verified.

[Full requirements](SPEC.md).

Hermes-specific qualification is tracked separately in [Hermes Agent and Hindsight evaluation and integration](../hermes-hindsight/SUMMARY.md); no product has been selected.

**Dependencies / related features:** [model-routing](../model-routing/SUMMARY.md), [knowledge-retrieval](../knowledge-retrieval/SUMMARY.md), [skills](../skills/SUMMARY.md), [task-runtime](../task-runtime/SUMMARY.md), optional [integrated-browser](../integrated-browser/SUMMARY.md).
