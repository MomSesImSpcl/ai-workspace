# Model registry, role routing and provider adapters

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 5.1 Capability-based model selection

- Model assignments **MUST** be configuration, not embedded into skill code. Define semantic roles such as `ArchitectureReasoning`, `Implementation`, `VisualReasoning`, `BulkSummarization`, `Research`, `CreativeWriting`, `ImageGeneration`, `3DGeneration`, `MotionGeneration`, `SpeechToText`, `TextToSpeech`.
- A role/profile specifies requirements such as modalities, context capacity, tool/structured-output support, cost/latency limits, privacy destination, needed reasoning quality and fallback behavior.
- A Model Registry tracks available models/providers, capabilities and limits, supported tools, input/output modalities, costs and availability; distinguish official/provider metadata from internally estimated benchmark scores.
- Users can select Automatic or manually override a specific model per session/task. Admins can change default role mappings globally; project owners can optionally choose permitted project overrides subject to policy.
- Profiles should allow primary/fallback lists and optional task-aware routing. No requirement for an additional small routing model in front of every operation if a simple deterministic policy is adequate.

## 5.2 Provider adapters

- One normalized workspace request/response/tool-event schema with provider-specific adapters and capability negotiation. Support streaming, cancellation, usage, structured outputs and tool calls to the extent actually offered by the provider.
- Don't flatten away important vendor-specific capabilities (reasoning controls, cached context, images/video, prompt conventions, file semantics, native agent CLI support). Provide optional model-specific profiles/adapters without coupling task definitions to the provider.
- Support both hosted APIs and local inference. Where useful, treat agent CLIs as adapters, without confusing CLI sessions with durable task state.
- Secret handling, provenance/telemetry and approval boundaries apply equally to API models, local models and agent CLIs.

**Product acceptance:** G6 in [acceptance scenarios](../../ACCEPTANCE.md).

## Role and agent assignments

Product-specific qualification of Hermes belongs to [Hermes Agent and Hindsight evaluation and integration](../hermes-hindsight/SPEC.md). This feature continues to own assignment/configuration and capability contracts; an agent runtime is not interchangeable with a single model call.

- **routing-001:** Configuration MUST distinguish the planning/design role (for example `ArchitectureReasoning`), orchestration role and implementation role. Each assignment identifies the compatible model or agent product and its integration, not only a model name. Supported agent adapters MAY use APIs, local inference or native agent CLIs; browser-only planning follows the [browser handoff contract](../integrated-browser/SPEC.md#planning-role-handoff) and MUST NOT be presented as an API adapter. Independent role selection and handoff behavior belong to [orchestrator-001–003](../ai-orchestrator/SPEC.md#independently-selectable-roles).

## Illustrative contract (not a production schema)

```yaml
# Example role mapping; current models can be changed without changing skills
profiles:
  ArchitectureReasoning:
    selection: configured-primary-with-fallback
    required: [text, tools]
  Implementation:
    selection: configured-primary-with-fallback
    required: [text, tools]
  VisualReasoning:
    selection: auto-or-user-override
    required: [text, image]
  BulkSummarization:
    selection: cheapest-approved-adequate
    preference: local
```

Adapt this example to actual provider, tool and platform capabilities.

## Acceptance evidence

- Demonstrate at least two real distinct provider adapters or a local-plus-hosted combination. Switch a role through configuration, rerun the same task and inspect provider/usage traces. Handoff at a checkpoint preserves goals/artifacts; unsupported capabilities produce explicit validation errors.
- For routing-001, save and reload distinct planning/design, orchestration and implementation assignments, including integration identifiers. Confirm that changing one leaves the others intact and that browser-only planning is represented as a manual handoff rather than an API integration.
