# Automatic agent, effort and context delegation

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 7.5 Local AI Orchestrator and Automatic Context Delegation

The workspace MUST provide a configurable, model-independent AI Orchestrator that serves as the default user interaction point.

By default, the orchestrator SHOULD run on a locally hosted AI model to minimize recurring API costs. However, the orchestrator MUST NOT be coupled to any specific model, provider, inference engine, or hardware configuration.

The orchestrator is responsible for understanding user requests, identifying required capabilities, selecting suitable agents and reasoning effort, gathering relevant context, constructing delegated instructions, and presenting the results.

Requirements:
1. Unified interaction: Users primarily converse with the orchestrator and may directly use individual agents.
2. Agent selection: Select configured models, agents or workflows by task, capabilities, user preferences and routing rules.
3. Effort selection: Select supported reasoning effort by task complexity, rules and quality/cost preferences.
4. Rules: Model/effort selection, classification, fallbacks and escalation MUST be configurable. AI recommendations cannot override mandatory policy.
5. Model override: Users MUST be able to explicitly choose a model or agent.
6. Effort override: Users MUST be able to override automatic effort. Provider-specific capabilities and limits MUST be respected and clearly explained.
7. Retrieval: Identify authorized context from files, code, docs, Git history, prior tasks, knowledge, skills and connected sources.
8. Required context: Users MUST be able to require specific context; automatic retrieval may supplement it unless disabled.
9. Fixed context: Users MUST be able to restrict supplementary retrieval to specified sources, except mandatory instructions, security controls and necessary execution metadata.
10. Context packages: Retrieved context MUST be relevant, token-efficient and tailored to the receiving agent’s responsibilities and capabilities.
11. Prompt construction: Include user requirements, context, project instructions, applicable skills, constraints and acceptance criteria in delegated instructions.
12. Routing transparency: Every delegation MUST display model, role, effort, routing reason, generated prompt and attached sources.
13. Request inspection: Users MUST be able to inspect the complete workspace-constructed request and attachments, with credential redaction and access controls. Distinguish unavailable provider-internal instructions/reasoning.
14. Prompt review: SHOULD support optional approval/editing before dispatch and reusable approval preferences for low-risk actions.
15. Expansion: Agents MAY request more authorized context; retrieval must respect fixed-context choices and permissions.
16. Continuity: MUST support durable state, rollover, handoffs, model changes and resumption without user reconstruction.
17. History: MUST retain dispatched prompts, models, effort, context references, timestamps, responses, tool use, errors and usage/costs.
18. Replaceability: Local AI MUST use a provider-neutral interface; replacing it through configuration must not require rewriting the Task Runtime, Model Registry, Knowledge System or UI.
19. Authority: Deterministic services MUST enforce permissions, tool access, spending, approvals and data access; AI alone is insufficient.
20. Project independence: MUST support programming, visual work, research, writing, assets, administration and future domains without Unity-specific assumptions.

Acceptance Criteria:
A user can submit a task without manually selecting a model or attaching project files. The local orchestrator selects an appropriate agent and supported effort level, gathers relevant authorized context, constructs and forwards the task instructions, and displays exactly what was dispatched.

The user can repeat the task while overriding the model, effort level, and required or exclusive context. These overrides are applied correctly, independently of the local AI's preferred choices.

The orchestrator itself can be replaced by another compatible model without modifying task definitions or the underlying orchestration services.
