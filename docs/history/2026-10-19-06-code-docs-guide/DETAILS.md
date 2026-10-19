# 2026-10-19: Code documentation rules in effect for new and changed code

**Scope:** [code-documentation](../../features/code-documentation/SPEC.md) codedoc-001–011; codedoc-012 unchanged.

**Decision (user, 2026-10-19):** start now rather than only in the retroactive pass. Reason discussed: a later pass can read the code but not recover intent or trade-offs, and codedoc-006 forbids inventing them; documented contracts also help agents today and turn the later pass into a check for that code. The user asked for the full rules, applied as if the index already existed, in the agents' workflow.

**Outcome:** [`docs/CODE_DOCS.md`](../../CODE_DOCS.md) (short form of codedoc-001–011, adapted: until the index exists, agents find and check references with search and file reads; this repository's conventions named); `AGENTS.md` step 5 links it; spec, summary status, overview marker, traceability row and progress updated. No ADR: a working rule, not a technology or architecture choice.

**Checks:** local links in edited files resolve (link script); the guide's examples name existing symbols (`agentChoice` in `app/src/turn.ts`) or are marked illustrative. No tool enforces the rules; review does.

**Known merge point:** branch `claude/settings-page-cleanup-0cfca2` also edits `AGENTS.md` step 5 (UI style guide link); expect a small conflict, keep both sentences.

**Branch:** `claude/trusting-mclaren-7a0c41`; commit: this entry's commit.

**Update (same day, user decision):** coverage changed from proportional to every named declaration at file, class or type level (functions, methods, classes, types, members, module-level constants and variables, private ones too) plus a one-line file header; locals skipped; each comment must add searchable words beyond the name; depth by weight; larger files accepted. codedoc-005 rewritten, codedoc-011 and 012 and the non-goals adjusted, `docs/CODE_DOCS.md` updated. Language-specific rules are expected with documentation indexing.
