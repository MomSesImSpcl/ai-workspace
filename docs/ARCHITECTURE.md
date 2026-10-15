# Architecture, security and quality contracts

Read affected sections when designing or changing a feature. These responsibilities do not prescribe separate services. Cross-platform and product invariants are in [shared principles](PRINCIPLES.md).

## 3.1 Logical components (required interfaces, not required processes)

The implementation **MUST** expose equivalent responsibilities, but they may begin within a modular monolith:

1. **Workspace API / control plane:** identity, session/project/task APIs, authorization, notifications, orchestration, artifact metadata and model/tool policy.
2. **Durable Task Runtime:** workflows, work-item graph, checkpoints, retries, budgets, scheduling, task events and synthesis.
3. **Model Gateway & Registry:** model profiles, provider adapters, requests/results/streaming, usage, routing and evals.
4. **Knowledge & Retrieval:** project/index/documentation/catalog search with authorization-aware context assembly.
5. **Capability & Tool Broker:** typed actions/MCP/API/CLI adapters, scope validation, secrets, permissions and audited execution.
6. **Runner(s):** connected machines or environments executing authorized work with local applications, files, code and model inference.
7. **Trusted Infrastructure Registry/Provisioner:** administrator-approved software, versions, hashes, installers and capability declarations.
8. **Technology Catalog:** discovered metadata about potentially useful third-party tools; explicitly not a trust/installation registry.
9. **Artifacts/Review:** task results, images, video, diffs, scene previews, reports and user acceptance.

## 3.3 Data isolation and data classification

- Every indexed chunk, cached summary, artifact, vector entry, task finding and model-bound context package must retain provenance: source ID, owner, repository if applicable, revision, access scope, indexing time and policy label.
- Authorization must be enforced at query/collection level and checked again before model submission. A vector database or generic LLM memory store is **not** an authorization boundary.
- Define data classes (e.g., public, project-internal, company-confidential, secrets) and permitted destinations. Do not silently send confidential repos or other protected data to a cloud model or third-party API that is not allowed under the user/organization's policy.
- Preserve audit records of external data transfers, model/tool invocations and approvals. Protect audit records from ordinary users altering or deleting them.
- Allow deletion/reindexing of data when repo access changes, source documents are removed or retention policies require it.

## 9.3 Security controls

- Separate read/search permissions from execute/write/delete/publish/secret/install permissions. High-risk operations require explicit scoped authorization and approvals.
- Treat project prompts, README content, retrieved webpages, transcripts and AI responses as untrusted input; prevent prompt injection from escalating tool scopes or revealing other repositories/secrets.
- Use allowlisted typed tools, sandboxed execution where possible, filesystem scope checks, network egress policy, timeouts, execution quotas and a complete action audit.
- Worktree/task isolation must be enforced by paths and credentials, not merely model instructions. Shared local processes are allowed only where the tool broker can enforce ownership safely.
- Validate tool download integrity, MCP permissions, package licenses and update policy. Provide emergency revoke/disable of tool/provider/runner.
- Encrypt communication and sensitive storage. Implement backups with tested restore, audit retention and appropriate cleanup of stale worktrees/secrets/artifacts.
- Revalidate authority for tasks that resume after long pauses, changed repo access or changed policy.

## 13.1 Reliability

- Task events and durable state survive client restarts and ordinary worker crashes; job execution uses safe retries and idempotency controls.
- External actions/commits/publications must not be duplicated on recovery. Interrupted tasks become resumable, failed or blocked with a clear reason.
- Back up critical state and perform at least one documented restore test. Use schema migration/versioning for durable data.

## 13.2 Observability and transparency

- Per-task timeline: who requested work; which model/provider ran each step; which tools/files/repos it accessed; actual step status; usage; failures; approvals; and final artifacts/evidence.
- Logs should be structured and redacted. Provide diagnostics export without credentials or unauthorized repository contents.
- Distinguish generated speculation from verified observations, real build/test results and explicit human approvals.

## 13.3 Performance and budgets

- Interactive UX should remain usable with background agents running. Prioritize/limit CPU, RAM, GPU/VRAM and API concurrency.
- Plan for hundreds of thousands of catalog records and very large project codebases through incremental indexing, progressive search and pagination; avoid loading everything into a single chat or Markdown document.
- Track storage usage (especially Unity per-worktree Libraries, video and models), prune artifacts by retention policy after required review/backup.

## 13.4 Portability and maintainability

- Keep platform-specific behavior behind adapters; support the chosen launch OS first without hard-coding paths/separators. Make runner platform coverage explicit.
- Define versioned API/tool schemas, migration paths and contracts. Test integrations against supported versions of Unity/external apps.
- Keep comprehensive but concise architecture docs, dependency diagrams, threat model, accepted/rejected architecture decisions (ADRs), and runbooks for onboarding, upgrades, restore, worker recovery and provider replacement.
- Prefer the simplest secure architecture that satisfies the agreed feature scope; split services only when justified.
- Validate accessibility and cross-platform support for actual target users. Before a production release, perform penetration/threat-model review, backup/restore drills, security/data-transfer audits and realistic task/corpus load tests. Meet documented release criteria with no unresolved critical security bugs; reliability/performance claims require measurements.

## 13.5 Automated testing

Required test categories as relevant capabilities are implemented:

- Unit tests for models, permission filters, routing and task state machines.
- Integration tests for persistent tasks, retries/restarts, provider adapters, file/index retrieval and worktree handling.
- Authorization regression tests: a user with only repo A must never get repo B in search, embeddings, model context, task output, notifications or shared artifacts.
- Tool security tests: unapproved installer blocked, malicious project manifest cannot run arbitrary code, MCP scope enforcement, secrets not leaked.
- Contract tests for runner/tool/model requests and error cases.
- Unity smoke tests: scene create/save/reopen, approved-asset-only placement, isolated editor, render capture in background, import validation and reviewable diff.
- E2E test for user starts background task, continues foreground chat, worker restarts, resumes, finishes, and user reviews result.
