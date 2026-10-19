# 2026-10-19: Documentation indexing and agent documentation rules specified

**Scope:** two user-supplied texts: a code-index addendum "Extensible Documentation Indexing & Code Linking" (proposed IDs code-index-029–038) and an agent-facing "Documentation Authoring & Maintenance Guide". Specification only; no implementation authorized.

**Outcome:**

- [code-index 7.2.4](../../features/code-index/SPEC.md#724-documentation-indexing-and-code-linking): requirements code-index-030–039, example use case, six acceptance checks added to the spec's acceptance evidence, nonbinding candidates, non-goals and open decisions. IDs shifted by one: 029 was the proposal dropped in [history 2026-10-17-37](../2026-10-17-37-code-index-json-yaml/DETAILS.md), so it is not reused (proposed 029→030 … 038→039). Requirements reference code-index-001, 006, 007, 009, 010, 011–014, 020–028 and `knowledge-001` instead of repeating them.
- New feature [code-documentation](../../features/code-documentation/SPEC.md) (codedoc-001–012). Own folder rather than part of [software-workflow](../../features/software-workflow/SPEC.md): the guide applies to every code change, while 6.3 is the workflow for complex features that may be skipped for small changes; software-workflow's summary links it. codedoc-012 adds the requested retroactive pass: once documentation indexing is built, existing code and docs are documented to these rules, proportionally and in reviewed tasks, starting with this repository.
- Registered in the [overview](../../OVERVIEW.md) and the traceability ID index; code-index summary status line and text updated; [progress](../../PROGRESS.md) lists both as specified.
- No ADR: no technology or architecture choice was made beyond the spec content; adapter registration, confidence rules and tooling stay open decisions.

**Open:** whether agents start documenting new and changed code now, before the index exists (discussed with the user; added only on agreement).

**Checks:** both feature files exist; local links in the edited files resolve (checked with a link script); IDs code-index-030–039 and codedoc-* were unused before.

**Branch:** `claude/trusting-mclaren-7a0c41`; commit: this entry's commit.
