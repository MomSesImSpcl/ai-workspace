# Project history and selective progress retrieval

[Shared principles](../../PRINCIPLES.md) and [related features](SUMMARY.md) apply.

## Purpose and status

Keep recorded development work available without replaying the complete history into every model context. The repository's current baseline is [compact progress](../../PROGRESS.md) plus monthly Markdown history, maintained under the [working agreement](../../WORKING_AGREEMENT.md#progress-and-history). This feature defines a possible structured successor; product behavior is **not-started**. JSONL, SQLite and migration tooling are proposals, not adopted technologies or authorized implementation work.

## Ownership

This feature owns development-history records and their current-state projection: scope, outcomes, decisions, handoffs and verification references. It does not own live execution/checkpoints ([task runtime](../task-runtime/SPEC.md)), wiki/planning records or public snapshots ([project planning](../project-planning/SPEC.md)), or inferred knowledge ([memory](../memory/SPEC.md)). Link those source records rather than maintaining duplicate authoritative copies.

[Retrieval / knowledge-001](../knowledge-retrieval/SPEC.md) owns shared indexing and AI search. History-specific extraction and canonical record storage belong here; any SQLite search index MUST participate in that shared layer rather than becoming a competing AI search pipeline. [Identity/projects](../identity-projects/SPEC.md) and [architecture 3.3, 9.3 and 13](../../ARCHITECTURE.md) retain authorization, security, durability and portability ownership.

## Requirements for a selected implementation

- **history-001 — Complete recorded history:** Retain existing records and provenance across imports, including proposals, approvals, superseded decisions, completed/remaining work and actual verification limitations. Records MUST have stable identities, dates, scope/project references, outcome/status and source/evidence links; unknown legacy values MUST remain explicitly unknown. A summary or successful documentation check MUST NOT imply application implementation or runtime validation. Corrections MUST retain attribution and supersession links rather than silently rewriting prior claims, subject to authorized retention/deletion policy.
- **history-002 — Selective reading:** Default startup MUST return a bounded current-state summary with active scope, blockers and next action. Queries MUST support scope/feature, requirement, date and keyword filters, return source-linked bounded results, and expose pagination or explicit expansion. Users MUST be able to retrieve all authorized retained records through expansion/export. Empty, partial or stale results MUST be distinguished; a query MUST NOT silently fall back to injecting all history. Measure selected context size separately from local records scanned.
- **history-003 — Evidence-based storage choice:** Before switching, compare the Markdown baseline with the needed JSONL and/or SQLite approach using representative history and queries. Record maintenance effort, query correctness, input-context size, latency, writer/concurrency needs and recovery behavior. Select only the capability justified by observed needs; neither both formats nor a migration is mandatory. Keep one canonical source and explicitly identify derived projections/indexes.
- **history-004 — Reversible migration:** Preserve source records and links during versioned import/export, validate record counts/content and representative queries, and provide a tested rollback/restore path before cutover. Interrupted or repeated imports MUST NOT lose records or create duplicates. Derived indexes MUST be rebuildable from their declared canonical source; do not require manual dual writes. A full export MUST preserve record relationships, provenance and status distinctions.
- **history-005 — Safe updates and recovery:** Selected storage MUST detect conflicting updates and protect successful writes. JSONL writers MUST serialize writes and detect/report malformed or partial records without silently discarding data; plain appends alone do not establish crash safety. SQLite implementations MUST use suitable transactions, migration/version checks and a backup/restore procedure accounting for the selected journal mode. Interrupted writes/imports and unavailable/corrupt indexes MUST yield explicit recoverable errors or a visibly incomplete fallback, never false completeness.
- **history-006 — Scoped portable access:** Read/search/export and write/delete actions MUST respect their separate project/repository permissions, including provenance, titles, snippets, backups and model-bound context. History content MUST NOT grant execution authority. Exclude credentials; enforce retention/deletion policy for canonical records and derived data. Selected tooling MUST preserve Windows/Linux/macOS behavior and keep human-readable export available without a running database service.

## Candidate approaches and when switching may help

| Approach | Benefit | Useful switching signal | Cost or limit |
|---|---|---|---|
| Compact Markdown + monthly archives (current) | Human editing, readable Git diffs, plain search and no new runtime | Keep it while finding and maintaining relevant entries is reliable and cheap | Free-form records require manual consistency; loading every archive defeats the design |
| JSONL canonical events + generated current summary | One structured event per line, streaming filters, export and straightforward automation | Repeated parsing/reporting needs stable fields, or tools already produce structured outcomes | Needs schema/version validation, serialized writers and explicit partial-write recovery; arbitrary queries may scan many records |
| SQLite as a rebuildable index over Markdown or JSONL | Date/feature/status filters, joins and optional full-text search without changing canonical records | Repeated scans or relationship queries are measurably costly | Index freshness and rebuilds need ownership; coordinate any search with knowledge-001 |
| SQLite canonical records + generated summary/export | Transactions, constraints and structured relationships in an embedded store | Record relationships, coordinated edits or consistency checks are awkward in files | Binary Git diffs are poor; backup, migration and export tooling become necessary; SQLite coordinates a single writer at a time and is not a general distributed-write solution |

These are alternatives, not a required progression. File size alone is not a migration trigger; compare actual retrieval effort and context output first. More users alone do not select SQLite: assess write contention and deployment topology. An initial SQLite index could be discarded and rebuilt without moving canonical history. A later canonical-store change requires a separate agreed cutover.

## Observable acceptance scenarios

These are future checks, not completed runtime evidence.

| Check | Observable result / requirement coverage |
|---|---|
| A1 — Faithful history (`001`) | Import a completion, proposal, superseded decision and failed check, including a legacy entry without a commit; retrieve each with original content/provenance and explicit unknowns. Documentation success stays distinct from runtime validation. |
| A2 — Bounded context (`002`) | With growing history, startup still returns only the configured current summary. Filter by feature, requirement, date and keyword; inspect source links and expand/export all authorized records. Report stale/partial results and measure model-bound output separately from local scan size. |
| A3 — Selection (`003`) | Run representative queries against Markdown and the proposed replacement, record correctness, maintenance/concurrency needs and measured context/latency, then document why to keep or change storage. No switch is required if the baseline suffices. |
| A4 — Migration and rollback (`004`) | Import twice and interrupt an import; compare identities, counts, content, relationships and links, export and restore the source. Rebuild a derived index without manual dual edits or record loss. |
| A5 — Failure safety (`005`) | Race updates, truncate a JSONL append or interrupt a SQLite transaction as applicable, and make an index unavailable. Preserve successful records, expose conflicts/incompleteness and restore from backup without claiming missing records never existed. |
| A6 — Boundaries and portability (`006`) | A user limited to project/repo A cannot retrieve B through search, export or context; reading history cannot authorize a write. Apply an authorized deletion to sources and derived copies under policy. Verify import/query/export/restore on Windows, Linux and macOS for supported tooling. |

## Non-goals and open decisions

No new database service, semantic search engine, automatic memory system, public roadmap or runtime event engine is required. This definition does not promise to reconstruct work that was never recorded or override retention/security policy.

Choose an initial concrete query/write workflow, canonical format, schema, summary/result bounds, index-refresh behavior, concurrency model and retention policy only when selecting implementation. Evaluate JSONL alone, a derived SQLite index or SQLite canonical storage against the current Markdown baseline; do not add all three by default. No implementation priority or sequence is assigned.
