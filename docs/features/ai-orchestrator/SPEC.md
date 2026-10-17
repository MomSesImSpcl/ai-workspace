# Configurable orchestration, agent roles and context delegation

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 7.5 Configurable AI Orchestrator and Automatic Context Delegation

The workspace MUST provide a configurable, model-independent AI Orchestrator that serves as the default user interaction point. Users MAY instead start with a separately selected planning/design agent and hand the agreed work to the orchestrator.

The orchestrator MUST be freely selectable from compatible configured models or agent products, whether local or hosted. Local inference is an option, not a required or preferred default. The orchestrator MUST NOT be coupled to any specific model, provider, agent product, inference engine, or hardware configuration.

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
18. Replaceability: The selected orchestrator MUST use a provider-neutral integration contract; replacing it through configuration must not require rewriting the Task Runtime, Model Registry, Knowledge System or UI. Adding a previously unsupported product may require an adapter.
19. Authority: Deterministic services MUST enforce permissions, tool access, spending, approvals and data access; AI alone is insufficient.
20. Project independence: MUST support programming, visual work, research, writing, assets, administration and future domains without Unity-specific assumptions.

### Independently selectable roles

[Project planning/wiki](../project-planning/SPEC.md) defines linked-page context and reviewed documentation-update proposals. Consume these through existing retrieval and inspection contracts; approved design records describe intent and do not replace current implementation evidence or grant action authority.

- **orchestrator-001 — Role assignments:** Users MUST be able to select the planning/design agent, orchestrator and coding/implementation agent independently, using the [role and adapter configuration](../model-routing/SPEC.md#role-and-agent-assignments). The roles MAY share one agent or use different products/providers. Selecting or changing one role MUST NOT require changing the others. Automatic selection remains available; a saved explicit assignment MUST be respected subject to capability and security policy.
- **orchestrator-002 — Handoffs:** Planning output MUST be transferable to the selected orchestrator, which can delegate agreed work to the selected implementation agent and collect its results. Use [durable task state and checkpoint handoffs](../task-runtime/SPEC.md), retaining the goal, accepted plan/version, constraints, acceptance criteria, authorized context references and resulting artifacts/evidence. A role change at a checkpoint MUST preserve that state without requiring the user to reconstruct it. Browser planning uses the [controlled browser transfer](../integrated-browser/SPEC.md#planning-role-handoff); manually transferred steps MUST be visible as awaiting user transfer rather than reported as automatic dispatch or completion.
- **orchestrator-004 — Suggested agent, model and effort for delegated work (later):** Before delegating a task, the orchestrator MUST read the agents' catalogs ([onboarding-008](../onboarding/SPEC.md)), suggest an agent, model and effort level for the task with a short reason, and let the user decide, either in a selection dialog showing the suggestion and the alternatives from the catalog, or by answering in the chat. The task MUST record the chosen values and whether they were the suggestion.
- **orchestrator-003 — Compatibility and authority:** Before dispatch, the workspace MUST check that the selected integration supports the assigned role's required capabilities and permitted data destination. If unavailable, unsupported or disconnected, preserve task state, explain the limitation and allow retry or explicit reassignment. Apply configured fallback rules only where no explicit assignment would be silently overridden. External agents, browser sessions and imported plans MUST NOT bypass the deterministic authority controls in requirement 19.

### Illustrative configuration and open integration decisions

Hermes-specific use-case qualification and any later adapter belong to the separate [Hermes Agent and Hindsight feature](../hermes-hindsight/SPEC.md). Role selection, handoffs and authority remain owned here; adding that feature does not select Hermes as the orchestrator.

A user could choose ChatGPT through the integrated Chromium browser for planning/design, ChatGPT Work for orchestration and Claude Code for implementation. This is a user-proposed example, not a fixed stack or a claim that those products expose compatible integrations. Each role remains replaceable independently.

Product-specific integration mechanisms, supported capabilities and provider terms MUST be verified when selecting an implementation scope. In particular, whether ChatGPT Work can perform the orchestration role through a supported integration is unresolved. Do not equate a browser subscription with API/tool access or assume it authorizes automated browser operation. Fully automatic browser handoffs are not required by this scope; existing manual transfer remains valid.

Acceptance Criteria:
A user can submit a task without manually selecting a model or attaching project files. The configured orchestrator selects an appropriate agent and supported effort level, gathers relevant authorized context, constructs and forwards the task instructions, and displays exactly what was dispatched.

The user can repeat the task while overriding the model, effort level, and required or exclusive context. These overrides are applied correctly, independently of the orchestrator's preferred choices.

The orchestrator itself can be replaced by another compatible model or agent product without modifying task definitions or the underlying orchestration services.

- **A1 (orchestrator-001):** Configure distinct compatible planning, orchestration and implementation agents. Replace each role independently, rerun a task and verify that the other two assignments remain unchanged and explicit choices appear in delegation history. Also run with one compatible agent assigned to all three roles.
- **A2 (orchestrator-002):** Transfer a versioned plan from the selected planner, delegate implementation and inspect the returned diff/results and verification evidence in the same durable task. Replace the orchestrator at a checkpoint and resume with the accepted plan, constraints and artifacts intact.
- **A3 (orchestrator-003):** Attempt dispatch through an unsupported integration, disconnect the selected orchestrator and attempt a prohibited data transfer. Each attempt produces an explicit blocked/awaiting-action state with preserved task context; no unauthorized dispatch or silent replacement occurs. Retry or explicitly reassign the compatible role and resume.
