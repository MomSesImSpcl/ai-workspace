# Semantic code indexing and change-aware knowledge

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 7.2 Code understanding

- Provide code-aware indexing including files, symbols, definitions, references, inheritance, interfaces, assemblies/projects, API usage, tests and relevant Git changes. For C#, use a semantic compiler-backed indexer rather than regex alone.
- Search internal code/approved existing dependencies **before** recommending a new dependency or reimplementation.
- Link documentation and architecture decisions to source versions; keep change summaries automatically updated after commits/meaningful code changes, but avoid stale/generated docs being mistaken for code truth. Where beneficial, use repository watchers, language tooling and Git commit hooks/events to propose updated documentation, with validation before treating it as current.
- Index information at repo granularity so unauthorized repository content is never returned from a multi-repo project query.

## 7.2.1 Language analysis

Requirements below refine 7.2. Priority stated by the user (2026-10-17): TypeScript/JavaScript (code-index-002) HTML/CSS (code-index-003, code-index-004) Markdown, shell and batch ([7.2.2](#722-markdown-shell-and-batch), code-index-010–019) come first, because development of this repository moves into the workspace once it is ready; together they cover every source language in it (its specs, ADRs and history are Markdown, its launchers shell and batch). C# and other languages follow through the same adapter interface; this is a priority, not a fixed delivery order.

- **code-index-001 — Language adapters:** Analysis MUST run through per-language adapters for definitions, symbols, references, imports/dependencies, types, diagnostics and relationship/impact queries. Each adapter MUST declare which queries it supports and MUST return `unsupported` or `unknown` instead of inventing results. A project MAY mix languages and configure which adapters apply.
- **code-index-002 — TypeScript and JavaScript:** Cover `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs` and `.cjs` with compiler/language-service analysis: definitions, references, module relationships and type information where available. JavaScript outside the project's `tsconfig.json` (for example `app/desktop/main.mjs`, outside `app/tsconfig.json` `include`) MUST still be analyzed through a separately configured program, not silently skipped. Dynamic or unresolved usage MUST be reported as uncertain.
- **code-index-003 — HTML:** Parse whole HTML documents and their embedded `<style>`/`<script>` blocks with source offsets preserved. Index elements, IDs, classes, attributes, hierarchy, links/assets and stable selectors; provide document symbols and diagnostics where the tooling supports them. `app/src/ui.html`, which holds the UI markup with inline CSS and script, is the first target.
- **code-index-004 — CSS:** Index external and embedded CSS: rules, selectors, declarations, custom properties, `@`-rules, imports and media conditions. SCSS/LESS only when the chosen tooling supports them. Results MUST distinguish a possible selector match from a browser-computed style.
- **code-index-005 — Cross-language UI links:** Best-effort links between HTML elements, CSS selectors/variables, JS/TS DOM queries, event handlers, assets and imported modules, each with source location and evidence. Inferred or dynamic links MUST be labeled uncertain; the index MUST NOT claim complete coverage of dynamic DOM or generated selectors.
- **code-index-006 — Shared retrieval:** Extracted records feed the existing repository-scoped index (`knowledge-001`, [knowledge-retrieval](../knowledge-retrieval/SPEC.md)); no parallel search or authorization path. Support symbol lookups, scoped queries, step-by-step traversal and compact context packages with verified locations and revision IDs. Specs, ADRs, history and tests are retrieved separately, only when needed.
- **code-index-007 — Incremental and current:** Edits, renames, config/dependency changes and commits refresh only the affected files and relationships, and invalidate stale results. Every record keeps repository, path, revision, range, source kind, confidence/evidence and indexing time. Multi-repo queries MUST enforce access before retrieval and again before any model receives context.
- **code-index-008 — Change impact:** For a symbol or UI element, return known references, imports, related styles/handlers and likely affected components and tests, with evidence and uncertainty. Results are advisory, not proof of all runtime dependencies.
- **code-index-009 — Degradation:** When a parser or language service is unavailable, report the limitation and return allowed fallback results (structural or text search, another adapter) instead of omitting them silently. Avoid full rescans; respect CPU and memory budgets.

Nonbinding candidates: [technology candidates](../../TECHNOLOGY_CANDIDATES.md).

**Non-goals:** replacing the shared retrieval service, memory, tests or human review; resolving all dynamic JS/DOM or CSS cascade behavior statically; a mandatory new database, AST format, language-server host, editor UI or daemon.

**Open decisions:** Compiler API directly or `ts-morph`; HTML parser; index persistence and cache; how much cross-language linking the first slice covers.

## 7.2.2 Markdown, shell and batch

Structural adapters under code-index-001 for files without compiler-grade semantics. They use the same records, scoping, incremental refresh and degradation as 7.2.1 (code-index-006, 007, 009); this section adds only what differs. Targets in this repository: the `docs/` tree, the `AI Workspace.cmd` launcher (batch) and the `AI Workspace.command` launcher (shell script).

- **code-index-010 — No execution, labeled findings:** Indexing and analysis MUST NOT run the scripts they read or grant any tool permission. External analyzers (linters, formatters) run only through the [tool broker](../tool-broker/SPEC.md) and runner policy. Results MUST separate verified parser/linter findings from heuristics and model inferences. A file that fails to parse is reported and skipped without stopping other indexing.
- **code-index-011 — Markdown structure:** Index `.md` heading hierarchy, section boundaries with stable ranges, links and anchors, fenced code blocks and frontmatter. `.mdx` only with a parser that supports it.
- **code-index-012 — Markdown links:** Resolve relative links and anchors inside the authorized scope, report broken links and missing anchors, and keep backlinks so agents can follow document-to-document references.
- **code-index-013 — Section retrieval:** Return just the relevant section of a document (for example one requirement block of a spec or one ADR section) with its heading path, source, revision and the document's status line where present. A spec section is not evidence that the behavior is implemented.
- **code-index-014 — Markdown lint:** Optional lint findings for formatting and links. Fixes go through normal review; no automatic rewrite of documents.
- **code-index-015 — Shell structure:** For `.sh` (Bash and POSIX sh; other dialects only when the tooling supports them) index functions, command invocations, sourced scripts, variables and line ranges. Dynamic commands, expansions and runtime-dependent paths MUST be marked uncertain.
- **code-index-016 — Shell diagnostics:** Return static diagnostics (file, line, severity, rule) and optional formatting checks.
- **code-index-017 — Risky commands:** Flag script-to-script and executable references and potentially destructive or privileged commands (deletes, force pushes, permission or registry changes) in shell and batch scripts for review. This is a heuristic aid, never presented as a safety guarantee or certification.
- **code-index-018 — Batch structure:** For `.bat` and `.cmd`, best-effort index of labels, commands, variable references, `CALL`/`GOTO` targets and line locations. Delayed and dynamic expansion and conditional execution MUST make affected relationships uncertain.
- **code-index-019 — Batch validation:** Batch scripts MAY be run for validation only in an isolated Windows runner with explicit execution approval ([runners](../runners/SPEC.md)); never to index them.

Nonbinding candidates: [technology candidates](../../TECHNOLOGY_CANDIDATES.md).

**Open decisions:** Markdown as a code-index adapter or a document extractor of [knowledge-retrieval](../knowledge-retrieval/SPEC.md) (either way it feeds the shared `knowledge-001` index); Markdown variants and shell dialects covered; lint rules; packaging of external analyzers per platform; batch parser dependency or a small own extractor; which analyses run by default and which on demand.

**Product acceptance:** G7 in [acceptance scenarios](../../ACCEPTANCE.md).

## Acceptance evidence

- Demonstrate working symbol search with definitions/references for the selected language integration; use compiler-backed analysis for C#. Changed files reindex incrementally without a full rebuild.
- Query a TS symbol and a symbol in a JavaScript file outside `app/tsconfig.json`; each returns definition, references and imports with revision, file and range.
- Query an element in `app/src/ui.html`; get its location, likely matching inline CSS selectors/variables and statically found JS/TS handlers, with dynamic links marked uncertain.
- Edit a source file or stylesheet; affected results update without a full rebuild and stale references disappear.
- Build a context package from affected symbols plus selected tests/specs; content from an unauthorized repository is excluded in a multi-repo project.
- With a parser unavailable, the query returns an explicit limitation plus fallback results.
- Query a heading in a multi-section spec; only that section comes back with heading path and location; a linked local document and anchor resolve; a deliberately broken local link is reported.
- In a test `.sh`, a function and a sourced script are found and a deliberate static diagnostic points at the right line.
- In a test `.cmd`, a label and a `CALL` target are found; a dynamically built command is marked uncertain, not reported as a dependency.
- Editing or deleting a Markdown or script file updates or removes its records without a full reindex; a malformed file does not stop other indexing; indexing runs no script.
