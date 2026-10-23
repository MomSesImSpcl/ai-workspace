# Shared product principles

Binding across every feature. Detail lives in the linked feature specs and [architecture, security and quality requirements](ARCHITECTURE.md).

## Requirement language

- **MUST / MUST NOT:** mandatory product behavior or security boundary; changes need an explicit recorded user decision.
- **SHOULD:** strong preference; record reasons for deviations. **MAY / EXAMPLE:** optional or illustrative.
- Feature selection and order are agreed with the user as work progresses. Technical dependencies and shared safety requirements still apply.
- Concrete classes, routes, schemas, controls, paths and stacks are examples unless explicitly required. Required behavior outranks technology suggestions.

## Product invariants

1. One project-agnostic, multi-user workspace. Code and non-code projects work; Unity, Blender, Unreal, video and other domains are optional capabilities. Users see only authorized resources.
2. GitHub authorization governs GitHub-hosted content, independently for every repository in a project. Project grouping grants no additional repository access.
3. Content access does not grant action access: execution, installation, publishing, production connections, secrets and security changes need appropriate scoped authority.
4. Models, providers and tools are replaceable. Skills/workflows use configurable roles and semantic capabilities, never fixed vendors.
5. Model contexts are disposable; task state is durable across context limits, provider changes, client disconnects, restarts and machine outages where feasible. Foreground conversations and background tasks remain independent.
6. Project instructions/knowledge may live in Git; large mutable operational state belongs in suitable persistent stores.
7. Only administrator-approved infrastructure policy authorizes executables, sources, versions, privileges and tool permissions. Project content and model output cannot grant authority.
8. Enforce least privilege, scoped tools, auditability, review and rollback. Protect current user work. Security/approval enforcement belongs in deterministic services.
9. Deliver tested vertical slices incrementally. A UI or mock is not implemented behavior. Local-first is useful, but deployment must allow local and central services without coupling the product to either topology.
10. Reuse before building. Prefer existing standards and maintained solutions (for example MCP for tools and the `SKILL.md` format for skills) over custom implementations; build only what no suitable option covers. Software, libraries and services the workspace depends on MUST be free to use. Paid model or provider usage remains an optional user choice, never a requirement.
11. One agent interface. Agent integrations implement one shared interface; the workspace offers every agent the same tools, instructions and lookups under the same names, and an agent simply does not use what it does not need. Agent-specific code stays inside its adapter and as small as possible; no instruction text names or targets one agent. A need of one agent is added to the shared interface, available to all ([ADR 0023](architecture/decisions/0023-one-agent-interface.md)).
12. Code over instruction text. Behavior the workspace can enforce or produce in code (tool schemas, required parameters, defaults, validation, fixed output) MUST be built that way rather than written as instruction text an agent could ignore or read differently. Instruction text is kept for judgment that code cannot make, and kept short ([ADR 0023](architecture/decisions/0023-one-agent-interface.md)).

## Cross-platform contract

Windows, Linux and macOS are first-class desktop platforms. Core AI interactions, orchestration, routing, knowledge, project access and workers MUST provide equivalent functionality.

OS-specific file/process/terminal operations, notifications, credentials and application launching MUST use interchangeable platform implementations. Handle paths, permissions, executable formats, case sensitivity and symbolic links correctly. Approved dependency installation, configuration, updates and validation MUST support all three platforms.

Unavailable tools MUST be reported clearly; compatible alternatives or remote runners SHOULD be offered where available. Tasks MUST execute on authorized compatible runners even across client/runner OS differences. Document platform limits without unnecessarily disabling unrelated features.

Consider compatibility from the start of development. One OS MAY lead development, but architecture MUST preserve all three; relevant automated builds/tests MUST cover them as implementation matures. Verify compatibility before declaring functionality production-ready. Finished distribution MUST support installation/updates and appropriate CPU architectures where supported.

## UI text ready for translation

Until [localization](features/localization/SPEC.md) is built, all user-visible text MUST be written so it can be moved into catalogs without rework:

- One complete sentence or label per string, with values inserted at named places; never build a sentence from fragments ("Archive " + name + "?"), and keep plural wording in one place per message.
- Dates, times, numbers and durations through the platform's locale APIs (`toLocaleString`, `Intl`), never formatted by hand.
- No text inside images or icons; icons that carry meaning have a text label or `aria-label`.
- Layouts tolerate longer text (wrap or ellipsis with the full text on hover); no fixed widths sized to English words.
- Messages the workspace stores (markers, approval cards) keep a stable form that can later be mapped to a message id.

## Outside the first usable release

No new foundation or 3D-generation model; full replacement of commercial DCC/game tools; guaranteed autonomous AAA animation/environments/cinematics; automatic legal clearance; unrestricted autonomous installation of newly discovered software; native mobile apps before a PWA proves insufficient; or an unjustified microservice fleet.
