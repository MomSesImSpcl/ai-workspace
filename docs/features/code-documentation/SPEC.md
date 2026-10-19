# Documentation authoring and maintenance by agents

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

Specified 2026-10-19. Since 2026-10-19 (user decision) codedoc-001–011 apply to new and changed code through the agent-facing [code documentation guide](../../CODE_DOCS.md), linked from `AGENTS.md`, as if documentation indexing already existed; until it does, agents find and check references with search and file reads. codedoc-012 waits for the index. Rules agents follow when they create or change code and its documentation in any project of the workspace, so documentation stays accurate, proportional and easy to retrieve through the [code index](../code-index/SPEC.md#724-documentation-indexing-and-code-linking) (code-index-030–039). It applies to every code change, not only to the [architecture → implementation → review workflow](../software-workflow/SPEC.md); that workflow's implementation and review steps apply these rules.

The rules do not prescribe Markdown, JSDoc, XML or any syntax: each project uses the conventions and tooling of its language, framework and documentation format. The goal is accurate retrieval and maintainability, not comment volume.

## Requirements

- **codedoc-001 — Intent and contracts:** Document responsibilities, constraints, invariants, meaningful inputs/outputs, side effects, errors, and why a non-obvious choice exists. Do not restate the symbol's name or narrate every line.
- **codedoc-002 — Discoverable wording:** Use concrete domain terms, useful synonyms, stable headings and precise names, so a query such as "how does the system choose an agent?" finds the entry even when the symbol is `selectAgent`.
- **codedoc-003 — Resolvable links:** Use the format's native link syntax where it exists, otherwise explicit repository-relative paths, symbol names and stable anchors. Prefer references the index can verify (code-index-031) over "handled elsewhere". An agent MUST NOT invent a symbol or claim a link is verified before it resolves.
- **codedoc-004 — Separate information types:** Specs describe intended behavior; source comments and API docs explain implementation contracts; architecture docs describe interactions; ADRs record reasons for decisions; tests and build results are evidence (code-index-035). Mark statements as proposed, implemented, deprecated or unverified where status matters.
- **codedoc-005 — Proportional:** Give detail to complex, reused, public, risky or non-obvious behavior. Trivial private helpers often need no comment. No repetitive prose or generated dumps; a short accurate paragraph beats a boilerplate template.
- **codedoc-006 — Truthful and current:** No fabricated rationale, guarantees, tests, performance claims or links. Treat docs as possibly stale and check the implementation before relying on them. Where observed behavior differs from intended behavior, document both separately.
- **codedoc-007 — Where to document:** Each kind of information goes where it belongs, and only what is meaningful for a format is written (a JSON Schema `description` for a field, a shell comment for a risky step, a C# XML doc referencing a member, a Markdown heading for a subsystem). Formats are not forced into one template.

  | Place | Contains | Not |
  |---|---|---|
  | Source-attached docs | public or important APIs, complex algorithms, invariants, error behavior, side effects, non-obvious decisions | obvious code, line-by-line narration |
  | Feature/spec documents | requirements, scenarios, acceptance criteria, constraints, intended external behavior | unsupported claims that a feature works |
  | Architecture/subsystem docs | component responsibilities, data and control flow, boundaries, dependencies, entry points, failure and recovery paths | copies of source files |
  | ADRs | context, alternatives, decision, trade-offs, consequences | invented rationale, unapproved decisions |
  | Operational/runbook docs | setup, migration, troubleshooting, commands, prerequisites, verified procedures | unchecked commands presented as safe |
  | Tests and examples | executable expected behavior and usage, linked to the owning API | claims that a test covers what it does not |

- **codedoc-008 — Significant symbols:** Where applicable, a significant symbol's documentation gives: purpose (one or two sentences with searchable domain terms); contract (inputs, outputs, invariants, preconditions, failure cases and side effects not obvious from signatures and types); reasoning (trade-offs or unusual decisions, with a link to an ADR when one exists); relationships (owning subsystem, verified references to docs, interfaces, callers, configuration or tests); examples (only when use is easy to misunderstand); status and limits (experimental, legacy, deprecated, planned). Not every field for every symbol.

  Example: `/** Returns an agent. */` is low value. Higher value: "Chooses the AI agent best suited to a task. Evaluates required capabilities, task complexity and available models. A user-selected override takes precedence when the agent is compatible. If no candidate qualifies, returns an explicit no-match result rather than silently selecting an incompatible agent. Related concept: Agent Routing. See: docs/architecture/orchestration.md#agent-selection". Searches for "agent routing", "task complexity", "model compatibility" or "agent override" find it.
- **codedoc-009 — Agent workflow:**
  1. Before editing: retrieve relevant implementation and documentation through the shared index; check status and revision; tell proposals from deployed behavior; read linked ADRs and requirements when contracts or architecture are affected.
  2. While editing: update documentation for changed contracts, assumptions, public behavior, algorithms or relationships; keep comments next to the symbols they explain; update higher-level docs only when affected; do not rewrite unrelated docs or widen scope without authorization.
  3. After editing: validate references and anchors with the available indexers; check comments against current code and tests; run permitted validation and report checks not run; reindex affected records incrementally (code-index-007).
  4. When uncertain: mark a claim unresolved or needing review rather than guessing; propose updates that need approval.
  5. Removals and renames: update or flag affected references, backlinks and examples; keep uncertainty labels where the index cannot verify a link.
- **codedoc-010 — Token-efficient retrieval:** Prefer indexed headings, concise descriptions, precise symbol links and short examples, so retrieval returns a small section and symbol, not whole files. Give each fact one owner and cross-link instead of duplicating. Keep exact source identity (repository/project, path, symbol or section, revision/range). Rank verified links above semantic similarity. Expand to callers, dependencies, implementation and tests only as needed. An agent MUST NOT change a function from its documentation alone; it inspects current source and tests first.
- **codedoc-011 — Quality checks:** A developer or agent can answer what a documented thing does, when to use it and where it is implemented without reading unrelated modules. Behavior claims match inspected source, unknowns are labeled. Important references resolve or their failure is visible. Descriptions use the project's domain vocabulary. Prose is proportional and not duplicated. No sensitive values or unauthorized repository content. Validation performed, omitted or blocked is reported accurately.
- **codedoc-012 — Retroactive documentation pass:** Once documentation indexing (code-index-030–039) is implemented for a repository's file types, the existing code and docs of that repository are brought in line with codedoc-001–011, so the index has the most to work with. The pass is proportional (codedoc-005): it adds or fixes documentation where it helps retrieval and understanding, not a comment on every function. It runs as agreed, reviewable tasks per area through the normal workflow, never as one unreviewed bulk rewrite, and starts with this workspace's own repository. Behavior the pass cannot confirm from source and tests is labeled unverified (codedoc-006).

## Acceptance

- After agent selection is updated, a search for "which agent handles this task?" leads to the Agent Selection docs and the matching symbol with paths and revisions and verified or explicitly uncertain links, and back from the symbol to the docs, showing whether the spec describes intended or implemented behavior.
- A review of a change finds its changed contracts documented next to the changed symbols, no comments on trivial code added for their own sake, and links that resolve or are flagged.
- After the retroactive pass for a repository, sampled significant symbols meet codedoc-008 and documentation searches for their domain terms return them; unverified behavior is labeled.

**Non-goals:** mandatory comments for every function; generated prose for its own sake; one universal template; treating comments as executable truth; a new search backend; automatically changing unrelated documents or bypassing review.

**Later (user note, 2026-10-19, not specified):** once the workspace develops itself, the orchestrator should load only the documentation rules a task needs (by the languages and file types it touches) instead of the whole guide, which may mean splitting the guide into per-language rule sets. Decide when that work starts ([ai-orchestrator](../ai-orchestrator/SPEC.md), orchestrator-005 lean setup).

**Open decisions:** whether the workspace also ships these rules as a skill for other projects; how the retroactive pass is split into tasks and reviewed.
