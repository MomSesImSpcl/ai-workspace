# Authorized search and selective context assembly

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 7.1 Context builder and retrieval

- Index authorized repository files, docs, task findings, Git history and optional external/project sources. Use conventional full-text search, metadata filtering, symbol-aware search and semantic embeddings as appropriate; do not require embeddings for every query.
- Provide a context builder that selects a **small, relevant, traceable** set of snippets/documents for the chosen model, instead of submitting an entire repository/doc library every time.
- Keep provenance, exact file path/revision/line or section, authorization label and timestamps alongside retrieved results.
- Allow iterative/deep searches, local prefiltering and retrieval expansion only as needed. Support cache invalidation and reindexing when sources change.
- The local AI acts as a cheap bulk processor/librarian/index assistant: summarizes Git changes, maintains project notes, processes large result sets, prepares context, documents APIs and identifies stale knowledge. It does not automatically replace deterministic indexing/Roslyn/Git queries.
- Distinguish LLM context cost from local indexing/database reads: only information actually passed to a hosted model should incur hosted input-token usage; local processing still consumes hardware resources.

- **knowledge-001:** Retrieval owns one shared, repository-scoped index and search layer. [Code indexing](../code-index/SPEC.md), the [documentation registry](../documentation/SPEC.md) and [memory](../memory/SPEC.md) MUST feed and query it rather than maintaining separate search pipelines; each keeps its own source-specific extraction (for example compiler-backed C# analysis or documentation sync) and its own records.

[Project history](../project-history/SPEC.md) supplies development records and current handoffs as source-specific records. It keeps canonical history storage; any derived query index integrates with this shared layer. Retrieve relevant entries with provenance rather than routinely injecting full archives.

## 7.4 Source/knowledge precedence

[Project planning/wiki](../project-planning/SPEC.md) supplies linked planning records and curated pages with revision, approval/status and evidence metadata to this shared layer. Its source-specific records and public snapshots remain owned there; `knowledge-001` and existing authorization boundaries remain in force. Non-Git pages retain explicit project/source scope rather than requiring a repository.

The separate [Hermes Agent and Hindsight feature](../hermes-hindsight/SPEC.md) evaluates Hindsight's internal retrieval against `knowledge-001`. No exception or federated search design is approved by that feature definition; this spec remains the owner of the shared-index requirement.

Default retrieval plan should prefer: (1) user's current project and its actual installed versions, (2) internal approved solutions and architectural decisions, (3) version-matched official docs, (4) relevant external solutions/current docs as needed. This order is configurable; do not force it when the question explicitly asks for something else.

**Product acceptance:** G7 in [acceptance scenarios](../../ACCEPTANCE.md).

## Acceptance evidence

- Answer a real project question with authorized file paths/revisions, relevant Git history and version-correct documentation. Verify repository isolation in full-text/vector/context results and incremental reindexing after source changes.
