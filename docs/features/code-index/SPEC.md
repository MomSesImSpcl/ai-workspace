# Semantic code indexing and change-aware knowledge

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 7.2 Code understanding

- Provide code-aware indexing including files, symbols, definitions, references, inheritance, interfaces, assemblies/projects, API usage, tests and relevant Git changes. For C#, use a semantic compiler-backed indexer rather than regex alone.
- Search internal code/approved existing dependencies **before** recommending a new dependency or reimplementation.
- Link documentation and architecture decisions to source versions; keep change summaries automatically updated after commits/meaningful code changes, but avoid stale/generated docs being mistaken for code truth. Where beneficial, use repository watchers, language tooling and Git commit hooks/events to propose updated documentation, with validation before treating it as current.
- Index information at repo granularity so unauthorized repository content is never returned from a multi-repo project query.

**Product acceptance:** G7 in [acceptance scenarios](../../ACCEPTANCE.md).

## Acceptance evidence

- Demonstrate working symbol search with definitions/references for the selected language integration; use compiler-backed analysis for C#. Changed files reindex incrementally without a full rebuild.
