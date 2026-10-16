# Hermes Agent and Hindsight evaluation and integration

[Shared principles](../../PRINCIPLES.md) apply. [Dependencies and related features](SUMMARY.md).

## Purpose and status

Evaluate concrete workspace uses for Hermes Agent and Hindsight and, only if selected after evaluation, integrate the useful parts behind existing workspace contracts. This feature owns product-specific qualification and adapters; it does not create a second orchestration, memory or retrieval system.

The separate feature definition is agreed. **The specific use case, adopting either product, the integration mechanism and an implementation scope still have to be evaluated and selected with the user.** Hermes and Hindsight can qualify independently; using both is optional. Product status: **not-started**. The research notes below are supporting evidence, not validated implementation or a technology commitment.

## Ownership and overlap

| Existing owner | Relationship to this feature |
|---|---|
| [Orchestration 7.5 / orchestrator-001–003](../ai-orchestrator/SPEC.md) | Owns independently selectable roles, delegation and handoffs. This feature evaluates whether Hermes can fulfill an assigned role through an adapter. |
| [Model routing 5.1–5.2 / routing-001](../model-routing/SPEC.md) | Owns model/agent assignments, capability negotiation and provider usage. A Hermes agent run must be distinguished from a single underlying model request. |
| [Memory 7.6](../memory/SPEC.md) | Owns capture, retention, status, provenance, corrections/history and user controls. This feature evaluates Hindsight as a possible implementation of those contracts. |
| [Retrieval 7.1 / knowledge-001](../knowledge-retrieval/SPEC.md) | Owns the shared repository-scoped index/search layer and context assembly. Hindsight adoption cannot silently create an independent search pipeline. |
| [Task runtime 4](../task-runtime/SPEC.md) | Owns durable task state, checkpoints, budgets, recovery and safe retries; external run/session identifiers are adapter state. |
| [Tool broker 6.2](../tool-broker/SPEC.md), [runners 3.2](../runners/SPEC.md) and [architecture 3.3 / 9.3](../../ARCHITECTURE.md) | Own deterministic authority, scoped execution, data destinations and auditing, including native tools exposed by external agents. |
| [Skills 6.1](../skills/SPEC.md) | Owns reusable workflows and their permissions; generated Hermes skills do not authorize themselves. |
| [Technology catalog 8](../technology-catalog/SPEC.md) | Owns general discovery and build-versus-buy research. This feature records the product-specific qualification outcome without requiring a working catalog before a bounded evaluation. |
| [Provisioning 9.1–9.2](../provisioning/SPEC.md) | Owns approved installation, version/integrity checks, updates and rollback. A successful evaluation does not itself authorize installation or activation. |

## Requirements

- **hermes-hindsight-001 — Qualify the use case:** Before implementing a product adapter, the selected scope MUST identify the user workflow, candidate role, owning requirement references, simpler baseline, expected benefit, data involved and bounded acceptance checks. Evaluate Hermes alone, Hindsight alone or the combination as appropriate. Record an evidence-backed adopt, reject or defer recommendation and unresolved limitations; recommendations require a user decision before becoming the selected implementation scope.
- **hermes-hindsight-002 — Explicit integration boundary:** For an adopted candidate, the integration MUST use a supported, versioned mechanism and expose its actual capabilities and limitations through the existing owning contracts. Unsupported roles or disconnected services MUST produce a visible blocked/unavailable state, preserve task state and allow explicit reassignment. No hard-coded vendor dependency in task definitions or mandatory coupling between Hermes and Hindsight is permitted.
- **hermes-hindsight-003 — Preserve authority and data scope:** Candidate evaluation and integration MUST obey existing source authorization, permitted-model destinations, retention controls, tool scopes and infrastructure policy. Validate all accessible native and MCP paths; a prompt, memory bank, tag or model-generated risk assessment cannot replace deterministic enforcement. Use public/synthetic data for an initial evaluation unless another data scope is explicitly authorized.
- **hermes-hindsight-004 — Resolve state and index ownership:** Before adoption, document which existing owner stores each task, approval, source record, memory and adapter identifier. Demonstrate compatible checkpoint/retry behavior and prevent duplicate ingestion or competing authoritative memory copies. Hindsight's internal search MUST either satisfy `knowledge-001` or remain outside product integration until an explicit decision changes that requirement in its owning spec; this feature does not grant an exception.
- **hermes-hindsight-005 — Evidence before activation:** Evaluate a selected pinned release and integration against the agreed workflow, including failure, permission denial, actual usage/cost, latency and supported platform limitations. Compare the result with the baseline, retain source/version/test evidence and distinguish documentation claims from measured behavior. Adoption MUST remain conditional on the existing free-to-use, security and cross-platform contracts. A bounded trial need not prove unrelated future features.
- **hermes-hindsight-006 — Disable and replace safely:** An adopted integration MUST be disableable without discarding workspace task state or authorized source evidence. Demonstrate resumption through an explicitly selected compatible replacement where supported, or preserve a blocked task with a concrete recovery action. Memory integration MUST provide a tested export/restore or migration path under the memory feature's portability/history requirements. Disabling retention MUST stop new capture; deletion obligations remain enforceable.

## Acceptance evidence

| Check | Observable result |
|---|---|
| A1 — Qualification (`001`) | Record a concrete workflow, baseline and owning requirements, compare bounded evidence and report adopt/reject/defer. The result does not automatically activate a product or require selecting both. |
| A2 — Adapter (`002`) | Run an adopted candidate through the chosen supported interface and inspect actual capability/role mapping, progress and artifacts. Disconnect it or request an unsupported role; no silent reassignment or false completion occurs. |
| A3 — Boundaries (`003`) | Attempts to access another repository, execute an unapproved action or retain forbidden data are denied, including through native tools or automatic memory hooks. Authorized work still succeeds and audit evidence identifies the action. |
| A4 — Ownership (`004`) | Inspect durable task/source IDs, restart during a selected workflow and reconcile interruption without blindly replaying a side effect or duplicating retention. Before Hindsight adoption, record how the actual index design satisfies `knowledge-001`, or the separately approved requirement change. |
| A5 — Measured fit (`005`) | Retain tested version/configuration, baseline comparison, actual checks, observed resource/model usage and platform limits. Documentation research alone cannot mark runtime acceptance as validated. |
| A6 — Exit (`006`) | Disable the integration, preserve task/source evidence and demonstrate the selected recovery path. For memory, verify export/restore, do-not-retain and deletion propagation against the chosen scope. |

## Non-goals and open decisions

No product installation, adoption, implementation, shared-index exception, new scheduler, mandatory cloud service or replacement of the existing domain contracts is authorized by this feature definition. Existing feature implementations may supply required contracts incrementally; no fixed delivery order is imposed.

Open: which concrete workflow benefits; which product(s) qualify; which interface and release; how external native tools are constrained; how Hindsight fits the common index; and whether measured benefit exceeds integration/operating cost. Cross-cutting persistence/index choice remains in [open decisions](../../OPEN_DECISIONS.md).

## Candidate findings (2026-10-16, nonbinding)

Assessed against then-current workspace specifications and upstream documentation. Neither product was installed or executed, no release was validated, and no technology or implementation scope was selected. Capabilities below are documented upstream, not locally demonstrated. Recheck upstream details when evaluating a release.

Both are useful candidates, with different owners:

| Candidate | Useful workspace role | Recommendation |
|---|---|---|
| Hermes Agent | Selectable orchestration/agent engine behind the workspace's agent integration | Evaluate against a narrow task before building equivalent agent-loop functionality. Keep workspace authority and durable task ownership explicit. |
| Hindsight | Memory extraction, consolidation and retrieval for decisions, preferences and project lessons | Strong functional match for memory, conditional on resolving shared-index ownership and proving access control, correction and deletion behavior. It can be evaluated independently of Hermes. |

Both core repositories carry MIT licenses: [Hermes](https://github.com/NousResearch/hermes-agent/blob/main/LICENSE), [Hindsight](https://github.com/vectorize-io/hindsight/blob/main/LICENSE). Self-hosting meets the core software's free-to-use criterion; hardware, optional hosting, inference and dependency/model licenses still need evaluation. A paid hosted service is not required by this recommendation.

The workspace currently contains specifications, not an implemented application. Adoption could save future implementation work; it is not a replacement of an existing runtime. See [progress](../../PROGRESS.md).

## Hermes: where it helps

Hermes is an agent application/runtime rather than just a model API. It provides an agent loop, model/provider selection, tools, skills, session search, subagent delegation, scheduling and multiple execution backends. Good candidate uses include project research, preparing bounded implementation instructions, collecting results and reusing successful workflows. Generated skills would remain reviewable proposals under workspace policy. [Repository overview](https://github.com/NousResearch/hermes-agent), [architecture](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture).

Concrete example: accept a Unity feature request, retrieve authorized context, prepare a task for the independently selected implementation agent, then collect its artifacts and checks. Hermes could occupy the orchestrator role while another product implements. This is a proposed adapter workflow; direct integration with a particular coding product has not been established here.

Hermes exposes HTTP/SSE, ACP over stdio and a finer-grained TUI gateway. For an initial workspace adapter, the HTTP Runs API is attractive: documented capabilities include run status, events, stop/approval controls, usage and idempotent creation. ACP is another option when session/tool/permission events fit the client. Discover capabilities and test the selected protocol; do not implement every transport. [Programmatic integration](https://hermes-agent.nousresearch.com/docs/developer-guide/programmatic-integration), [API server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server), [ACP](https://hermes-agent.nousresearch.com/docs/user-guide/features/acp).

Proposed ownership:

1. Workspace authenticates the caller, records the accepted goal, role assignments, budget, allowed data and task checkpoint.
2. Adapter submits a bounded job to an isolated Hermes profile/process and maps its run/session IDs to the workspace task.
3. Hermes reasons and requests approved workspace capabilities. The broker validates scope and authority before execution; the model cannot grant itself access.
4. Adapter records progress, actual model/usage, approvals and artifacts. On interruption, reconcile the remote outcome before deciding whether another step is safe.

The current Runs API documents interrupted/unknown outcomes and retry-key recovery; these are useful building blocks, not proof of provider-independent task graphs, checkpoint migration or safe replay of every external action. Avoid creating a second scheduler: retain workspace task ownership unless a later evaluation shows Hermes can implement the required runtime contract adequately.

### Hermes adoption gates

- **Authority:** its default `smart` shell approval mode uses an auxiliary LLM for risk decisions. That does not satisfy the workspace's deterministic permission requirement by itself. Sandbox/filesystem/network/credential restrictions and broker enforcement must remain outside model discretion. Prompting Hermes to use only the broker is insufficient. [Security](https://hermes-agent.nousresearch.com/docs/user-guide/security), [workspace security](../../ARCHITECTURE.md#93-security-controls).
- **Bypass paths:** ACP's default toolset includes native file, terminal and code-execution capabilities, as well as configured MCP servers. Explicitly restrict toolsets and the process environment; supplying an approved MCP server does not remove native tools. [ACP toolsets](https://hermes-agent.nousresearch.com/docs/user-guide/features/acp).
- **Replaceability:** task state, selected roles, approvals and artifacts must remain usable when Hermes is replaced. Do not equate an OpenAI-compatible response format with a plain model call: Hermes may perform tools and multiple inference steps internally.
- **Budgets and audit:** measure child-agent, memory and tool costs and verify cancellation/budget enforcement reaches the entire run. Event previews alone are not a complete action audit.
- **Skills and provisioning:** self-improvement cannot authorize plugin installation, policy changes or newly generated executable workflows. Apply existing trusted-infrastructure controls.

## Hindsight: where it helps

Hindsight exposes `retain` to extract/store useful information, `recall` to retrieve it and `reflect` to synthesize an answer from memory. Its memory engine adds entity/time-aware retrieval and evidence-backed consolidation. This fits cross-session project orientation better than using a transcript as the entire knowledge base. [Overview](https://hindsight.vectorize.io/), [retrieval](https://hindsight.vectorize.io/developer/retrieval).

Concrete example: retain that a project chose a particular asset-loading approach, why an alternative failed and which source supports the choice. A later authorized agent can recall the decision, then inspect current code and version-matched documentation. A later reversal should preserve the earlier evidence and identify the current decision. Hindsight documents contradiction handling and observation history, but user approval, exact version restoration and all workspace status categories still need contract tests. [Observations](https://hindsight.vectorize.io/developer/observations), [memory requirements](../memory/SPEC.md).

Proposed ingestion: authorized task/conversation event → workspace retention/privacy checks → Hindsight adapter → extracted memory with stable source ID, revision, timestamp, owner and scope. Keep authoritative task events and source evidence outside generated summaries. Ingestion retries must not duplicate facts; source deletion must invalidate derived content as well as the original record.

REST/SDK integration suits automatic lifecycle ingestion; scoped MCP tools suit agent-initiated operations. Use one controlled ingestion path to avoid both integrations storing the same conversation. Bank IDs and allowed destinations come from trusted workspace identity, never arbitrary model arguments. Hindsight's MCP surface includes destructive operations, so expose only operations the caller is authorized to use. [MCP server](https://hindsight.vectorize.io/developer/mcp-server).

Self-hosted Hindsight uses PostgreSQL/pgvector, with embedded PostgreSQL available for local development. It supports local LLM providers, so memory processing need not require recurring cloud inference charges. Extraction, consolidation and synthesis still consume resources; measure their latency and quality on the intended hardware. [Storage](https://hindsight.vectorize.io/developer/storage), [models](https://hindsight.vectorize.io/developer/models).

### Hindsight adoption gates

1. **Shared index is the main architectural issue.** [knowledge-001](../knowledge-retrieval/SPEC.md) requires memory, documentation and code to use one shared index/search layer. Hindsight has its own retrieval pipeline. A common PostgreSQL server or a gateway in front of two independent indexes does not satisfy this requirement. Either demonstrate that Hindsight can serve the common layer without distorting code/document search, use its extraction/consolidation with searchable records in the common index, or obtain an explicit decision to allow federated memory retrieval. No supported off-the-shelf bridge was established in this assessment. Bypassing native recall could also remove part of Hindsight's benefit.
2. **Source ACLs:** self-hosted API authentication is disabled by default unless configured. Tenant extensions can isolate users, and operation validators support custom checks, but neither automatically implements changing GitHub repository access. Enforce repository authorization on writes, retrieval, consolidation, generated pages and final model context. Separate banks/tenants where derived summaries must not mix permissions. Filter tags alone are not an authorization boundary. [Configuration](https://hindsight.vectorize.io/developer/configuration), [extensions](https://hindsight.vectorize.io/developer/extensions), [multi-tenant patterns](https://hindsight.vectorize.io/blog/2026/08/04/per-user-multi-tenant-agent-memory).
3. **Knowledge status and control:** prove that proposals, user instructions, confirmed decisions and superseded facts remain distinguishable. Demonstrate inspect/correct/delete/restore and propagation into derived observations/pages. Semantic conflict reconciliation is not the same as an approval/versioning workflow.
4. **Privacy and reliability:** apply do-not-retain and permitted-model rules before extraction. Persist ingestion failures for retry, surface unavailable/stale memory, cap resource use and test backup/export/restore. Do not silently drop events or treat generated memory as authoritative evidence.

## Using both

An official integration already exists: the maintained Hermes catalog memory-provider plugin can connect to an external Hindsight instance. The old standalone `hindsight-hermes` pip plugin is deprecated. The provider supports automatic recall/retention and profile/bank configuration; it is updated separately from Hermes. [Current integration](https://hindsight.vectorize.io/sdks/integrations/hermes).

For a single-user experiment, this is a short route to testing an agent with persistent memory. For the workspace product, automatic turn capture and recall must pass the same retention, source-ACL and shared-index gates as every other client. Direct provider access is not automatically acceptable merely because both components are local. Avoid parallel Hermes flat-file memory and Hindsight stores containing competing copies of project decisions.

Both upstreams document Windows, Linux and macOS paths, with platform/package qualifications. This was not a cross-platform execution test. [Hermes installation overview](https://github.com/NousResearch/hermes-agent), [Hindsight platform matrix](https://github.com/vectorize-io/hindsight#supported-platforms).

## Proposed evaluations, not an implementation commitment

Choose the evaluation that addresses the next selected feature; neither is a prerequisite for the other.

| Evaluation | Smallest useful experiment | Acceptance / stop condition |
|---|---|---|
| Hindsight memory | Synthetic decisions from two repositories, including a reversal, an unconfirmed proposal, a secret and a do-not-retain event; query from two agent clients. | Relevant recall with source references; no cross-repo disclosure; proposal stays unconfirmed; correction/history/deletion work; forbidden data is not retained. Measure total model/context cost and latency against simple authorized FTS/notes. Resolve `knowledge-001` before product adoption. |
| Hermes orchestration | One read-only project research task through a pinned agent adapter, followed by one explicitly authorized scoped write only if the boundary works. | Stream progress, deny an out-of-scope action, interrupt/reconnect, reconcile a crash without blindly replaying a side effect, observe usage/budget behavior and return an evidence-linked artifact. Demonstrate an external implementation-agent handoff separately before claiming it works. |

Use public/synthetic data initially; select approved releases, local dependencies and an allowed model before running either experiment. Keep a fallback to the task record and current source retrieval if memory or the external agent is unavailable. Adopt only if the measured improvement outweighs adapter, security and operating costs.

## Evidence and limits

Reviewed current upstream documentation, core license files and affected workspace specs: memory 7.6, knowledge 7.1/`knowledge-001`, orchestrator 7.5/`orchestrator-001–003`, task runtime 4, tool broker 6.2 and architecture 3.3/9.3/13. No application code, upstream test suites, installation, security audit, performance benchmark or working integration was executed. Upstream benchmark claims were not used as proof of workspace fit. All affected product features remain `not-started`.
