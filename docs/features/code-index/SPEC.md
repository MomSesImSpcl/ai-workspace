# Semantic code indexing and change-aware knowledge

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 7.2 Code understanding

- Provide code-aware indexing including files, symbols, definitions, references, inheritance, interfaces, assemblies/projects, API usage, tests and relevant Git changes. For C#, use a semantic compiler-backed indexer rather than regex alone.
- Search internal code/approved existing dependencies **before** recommending a new dependency or reimplementation.
- Link documentation and architecture decisions to source versions; keep change summaries automatically updated after commits/meaningful code changes, but avoid stale/generated docs being mistaken for code truth. Where beneficial, use repository watchers, language tooling and Git commit hooks/events to propose updated documentation, with validation before treating it as current.
- Index information at repo granularity so unauthorized repository content is never returned from a multi-repo project query.

## 7.2.1 Language analysis

Requirements below refine 7.2. Priority stated by the user (2026-10-17), ordered by how much this repository uses each language today, because its development moves into the workspace once it is ready:

1. TypeScript/JavaScript (code-index-002)
2. HTML/CSS (code-index-003, code-index-004)
3. Markdown ([7.2.2](#722-markdown-shell-and-batch), code-index-011–014): specs, ADRs and history
4. JSON and YAML ([7.2.3](#723-json-and-yaml), code-index-020–028): package, TypeScript and CI configuration
5. Shell and batch (code-index-015–019): the launchers

Together these cover every file type in the repository today. Shared rules (code-index-001, 005–010) apply to all of them. C# and other languages follow through the same adapter interface. This is a priority, not a fixed delivery order.

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

## 7.2.3 JSON and YAML

Structural adapters for configuration under code-index-001, with the shared rules of 7.2.1 and code-index-010 (no execution, labeled findings). Configuration content is data, never instructions to the agent. Targets in this repository: `app/package.json`, `app/package-lock.json`, `app/tsconfig.json`, `.github/workflows/ci.yml`.

- **code-index-020 — Formats:** Strict `.json` and `.yml`/`.yaml`. Comments and trailing commas only in formats that allow them (for example `tsconfig.json`, `.jsonc`); strict JSON MUST NOT silently accept them.
- **code-index-021 — Structure:** Index keys, nested paths, arrays/sequences, values and types, document boundaries and exact ranges; keep comments where the parser supports them. Secret-looking values MUST be redacted from search and model results.
- **code-index-022 — Validation:** Report parse errors, duplicate keys and, where a schema applies, type violations and missing or unknown fields, each with file, range, severity and source. A file that parses is not thereby schema-valid.
- **code-index-023 — Schemas:** Optional JSON Schema association through an explicit project mapping, a local schema, `$schema` or a trusted built-in match; validate JSON and YAML and show the schema and version used. Remote schemas need policy-approved network access and versioned caching; no implicit untrusted downloads.
- **code-index-024 — References:** Track `$ref`, relative file paths, config imports, workflow `uses` and declared dependencies. Unresolved, dynamic or convention-based links are uncertain; YAML tags and expressions are never executed.
- **code-index-025 — YAML specifics:** Multi-document files, anchors, aliases and merges where supported, with source locations; report unknown custom tags; bound alias expansion against resource exhaustion; do not assume YAML 1.1 or 1.2 scalar coercion where the consuming tool decides.
- **code-index-026 — GitHub Actions:** Treat `.github/workflows/*.yml`/`*.yaml` as workflows and validate jobs, steps, `needs`, expressions and syntax with a dedicated checker, without evaluating `${{ … }}`. Flag untrusted expression interpolation and privileged steps for review (heuristic, as in code-index-017).
- **code-index-027 — Key-path lookup:** Look up by key path (for example `compilerOptions.strict`, `jobs.test.strategy.matrix.os`) and return a small extract with path, revision, range, schema and diagnostics, not the whole file, through the shared index (code-index-006).
- **code-index-028 — Generated files:** Distinguish generated files (for example `package-lock.json`) from hand-written config; changes to generated files go through the tool that owns them (the package manager), not direct edits.

Nonbinding candidates: [technology candidates](../../TECHNOLOGY_CANDIDATES.md).

**Non-goals:** executing configuration, guaranteed resolution of dynamic references, mandatory schema downloads, a separate search database.

**Open decisions:** tool choice, cache format, supported YAML schema dialects, default lint rules.

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
- `compilerOptions.strict` in `app/tsconfig.json` returns its value and position; comments allowed in tsconfig are not strict-JSON errors.
- `scripts.typecheck` in `app/package.json` returns only that entry with its source; `app/package-lock.json` is marked generated.
- `jobs.test.strategy.matrix.os` in `.github/workflows/ci.yml` returns the platform list linked to the `test` job; workflow validation runs without evaluating `${{ … }}`.
- A malformed JSON/YAML fixture yields located diagnostics, including duplicate keys and schema mismatches where a schema applies; editing one entry refreshes it and its references; secrets, unauthorized repositories and unapproved remote schemas never reach model context.
