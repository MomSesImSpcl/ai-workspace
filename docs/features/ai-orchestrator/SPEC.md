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
- **orchestrator-004 — Suggested agent, model and effort for delegated work (built 2026-10-18, [history](../../history/2026-10-18-06-orchestrator-slice-1/SUMMARY.md)):** Before delegating a task, the orchestrator MUST read the agents' catalogs ([onboarding-008](../onboarding/SPEC.md)), choose an agent, model and effort level for the task and show the choice with a short reason ([ADR 0011](../../architecture/decisions/0011-orchestrator-works-through-tasks.md)). The user MAY override it, in the chat or a selection dialog with the alternatives from the catalog. The task MUST record the chosen values and whether the user overrode them. Built: the task card shows agent, model, effort and reason; **Change** (on a paused or finished task) opens a dialog with the catalog's choices and marks the task as changed by the user.
- **orchestrator-006 — The orchestrator chat works through tasks ([ADR 0011](../../architecture/decisions/0011-orchestrator-works-through-tasks.md); built 2026-10-18, [history](../../history/2026-10-18-06-orchestrator-slice-1/SUMMARY.md)):** In a chat with the orchestrator, every request to change something MUST become a task run by the implementation role ([sessions-002](../sessions/SPEC.md#projects-agents-and-context)); the orchestrator MUST NOT do that work itself. Questions about the work (a task's state, why it failed) are answered directly. A follow-up or correction to earlier work MUST go to that task as a reply. If a request is too vague to start, the orchestrator asks first; its rule MUST be explicit enough that this is rare. Tasks run without a token cap unless the user asks for one (a switch next to the chat box, or accepting the orchestrator's suggestion). A separate chat mode for planning without tasks is planned, not specified. Built: an orchestrator chat is a session of the Orchestration role (the default for a new session; Chat stays selectable). The workspace blocks the orchestrator's own edit and command tools by role, not by agent, so swapping the agents of the Orchestration and Implementation roles keeps the implementation agent unblocked: Claude Code runs with those tools denied, Codex with a read-only sandbox and no escalation. Tools of the user's own MCP servers are not blocked yet ([#16](https://github.com/MomSesImSpcl/ai-workspace/issues/16)). Changed 2026-10-18 by the user ([history](../../history/2026-10-18-07-task-routing/SUMMARY.md)):
  - Only a change or correction to a task that is still running (or paused) goes to it. It is queued and reaches the task when its current step ends.
  - A finished task is never continued by the orchestrator. More work, even like a finished task's, becomes a new task. When related, it names the earlier task (`basedOn`), and the new task starts with that task's goal and last reply instead of its whole conversation.
  - The user continues a finished task with the reply field under its card.
  - A task the chat sends a message to moves its card to that turn.
- **orchestrator-003 — Compatibility and authority:** Before dispatch, the workspace MUST check that the selected integration supports the assigned role's required capabilities and permitted data destination. If unavailable, unsupported or disconnected, preserve task state, explain the limitation and allow retry or explicit reassignment. Apply configured fallback rules only where no explicit assignment would be silently overridden. External agents, browser sessions and imported plans MUST NOT bypass the deterministic authority controls in requirement 19.
- **orchestrator-005 — Lean agent setup per task (agreed direction 2026-10-18, not designed in detail):** To cut the fixed prompt sent with every model call, a task's agent MUST load only part of the user's setup:
  - **Only per-run switches (user request 2026-10-18):** the orchestrator MUST switch items off only for the one agent run it starts (for example Claude Code `--disallowedTools`, `--strict-mcp-config`, `--settings`). It MUST NOT change account-wide or user-level setup, such as disconnecting a claude.ai connector or editing the user's agent settings, since that would also remove the item from running tasks and other chats. If an item can only be switched globally, it stays on.
  - **Rule files:** project rule files (the repository's AGENTS.md/CLAUDE.md) always load. Global rule files (the user's own, for example `~/.claude/CLAUDE.md`) load per role behind an on/off setting that defaults to on. Open check (user, 2026-10-18): since the orchestrator sets effort and the other per-task choices, the implementation role may need no global rules at all; verify with real tasks (does work suffer without them?) before changing that role's default to off. Turning them off must be verified against each agent, since Claude Code loads the user's CLAUDE.md even with `--setting-sources project` ([integration matrix](../../INTEGRATIONS.md)). Measured 2026-10-18 for Claude Code with the user's setup, one call: full 90,465 prompt tokens; three Google connectors denied with `--disallowedTools` 74,066; no MCP servers (`--strict-mcp-config`) 47,558 ([history](../../history/2026-10-18-03-lean-agent-setup/DETAILS.md)).
  - **Plugins, skills, MCP servers:** each item in the agent's inventory ([onboarding-010](../onboarding/SPEC.md#requirements)) has, per agent and role, one of three states: **always on** (for example caveman, ponytail, rtk), **orchestrator decides** (the default, also for newly installed items) or **off**. The orchestrator (and a lean chat agent) MUST see each item's short title and description from the inventory, not its full definition, to decide. For each task the orchestrator enables the always-on items plus those the goal needs, including their dependencies; a task that reports a missing tool is restarted with it added.
  - Changes runtime-001 (tasks start with the agent's full setup) for tasks the orchestrator starts.
  - **Open decision:** whether chat sessions also run lean (always-on items only, and a request that needs more becomes a task whose setup the orchestrator picks, sessions-002) or keep the full setup.

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
