# Automatic long-term memory and project knowledge

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 7.6 Automatic Long-Term Memory and Project Knowledge

Hindsight-specific qualification and any later provider adapter belong to the separate [Hermes Agent and Hindsight feature](../hermes-hindsight/SPEC.md). The memory behavior, history, provenance, source permissions and user controls below remain authoritative regardless of provider; Hindsight adoption is undecided.

The workspace MUST provide a persistent, model-independent Memory System managed by the configured AI Orchestrator.

By default, a locally hosted AI model SHOULD identify, organize, and maintain useful memories without recurring cloud inference costs. The memory-processing model MUST remain replaceable.

Memory serves as a fast, curated understanding of the workspace, user, and active projects. It MUST complement, not replace, thorough task-specific context retrieval or authoritative source verification.

Requirements
1. Capture: MUST identify useful durable information from conversations, completed tasks, findings, project changes, decisions and other authorized sources.
2. Retention: MUST evaluate usefulness, relevance, durability, uniqueness and reliability before storage. Trivial details, temporary debug output and duplicates SHOULD NOT become permanent memories.
3. Scope: Support global, user, project, repository and task memories; apply source-based access controls to every record.
4. Shared access: All authorized models/agents MUST be able to retrieve applicable memories through one provider-independent Memory Service.
5. Categories: Support overviews, goals, requirements, architecture, conventions, decisions, preferences, constraints, lessons, rejected alternatives and open questions. Categories MUST be extensible and project-agnostic.
6. Status: Distinguish confirmed information, user instructions, inferences, proposals, questions and superseded decisions. Speculation MUST NOT silently become fact.
7. Provenance: Automatically generated memories MUST retain originating conversation, task, revision, document or other evidence references where available.
8. Deduplication: Consolidate overlaps without losing distinctions, sources or previous decisions.
9. Conflicts: Detect contradictions with memories, newer decisions, docs and code; distinguish conflicts from valid context-dependent facts.
10. Updates: Update, supersede, archive or flag changed knowledge. Important or uncertain changes SHOULD be proposed for approval instead of silently replacing confirmed decisions.
11. History: Preserve prior values, sources, timestamps and update reasons; allow inspection and restoration.
12. Project overview: Automatically maintain a concise structured overview, which SHOULD include purpose, goals, components, constraints, conventions and recent decisions.
13. Injection: Context Orchestrator MUST select memories by task, project, user and agent responsibilities; MUST NOT inject all memories indiscriminately.
14. Independent retrieval: Memory MUST NOT replace relevant files, code, docs, Git history or authoritative evidence. Technically accurate tasks MUST retrieve and validate current sources.
15. Authority: Memory is derived. Conflicts with verified current sources MUST be investigated, disclosed where material, and corrected or flagged.
16. Learning: SHOULD identify recurring corrections to routing, effort, context, output and workflows; MAY propose ruleset changes, but MUST NOT silently change mandatory security or approval policy.
17. User control: Users MUST be able to inspect, search, create, edit, correct, pin, archive and delete authorized memories; honor explicit remember/do-not-retain instructions.
18. Privacy: Extraction/retrieval MUST respect permissions, classification, retention and allowed model destinations. Sensitive content MUST NOT enter broadly accessible global memory.
19. Incrementality: SHOULD process new/changed information instead of repeatedly analyzing complete histories or repositories.
20. Model independence: Storage, indexing, retrieval and provenance MUST be independent of the extraction/orchestration model.
21. Self-development: When this workspace is a project, its architecture, requirements, decisions, progress, limitations and conventions SHOULD use the same project-memory system.
22. Portability: SHOULD use documented exportable formats with stable IDs, references and version metadata. Changing inference, providers or storage MUST NOT discard knowledge.
23. Maintenance: MUST periodically review duplicates, stale knowledge, contradictions, redundancies and consolidation opportunities. Routine work SHOULD be automatic using the configured model, preferably locally. Significant changes to confirmed decisions, requirements or instructions MUST remain reviewable. Maintenance MUST preserve provenance/history and permissions and avoid needless unchanged-data processing. Frequency and resource usage MUST be configurable.

Acceptance Criteria:
During a conversation, a user establishes a durable project decision without explicitly requesting memory storage. The local AI identifies the decision, stores a correctly scoped memory with provenance, and makes it available to another authorized agent in a future task.

When the user later changes that decision, the system detects the conflict, updates or proposes updating the memory, and preserves the previous version.

When a coding agent is assigned a related implementation task, it receives the relevant project memory for orientation but still retrieves and verifies the current source code and documentation.

Replacing the local memory-processing model does not require rebuilding the memory database or changing how agents access stored memories.
