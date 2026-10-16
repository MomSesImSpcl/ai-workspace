# 2026-10-16 — Docs consolidation: less duplicated and stale context

- **Scope:** user request: remove bloat from the root docs without losing requirements.
- **Outcome:**
  - Reading order/selection rules removed from the [overview](../../OVERVIEW.md) (loaded every session) and working agreement step 1; both point to [AGENTS.md](../../../AGENTS.md), which keeps them. README's human-facing agent prompt kept.
  - [Traceability](../../REQUIREMENTS_TRACEABILITY.md): acceptance column dropped (G-references already in every owning spec); not-started rows became a one-paragraph section/ID index; the original-spec split table and Hermes note moved to the [imported snapshot](../2026-10-16-00-imported-progress-snapshot/DETAILS.md#spec-split-record-moved-from-traceability-2026-10-16). Fixed stale routing-001 cell (delegation is built).
  - [Open decisions](../../OPEN_DECISIONS.md) #1, #2, #4 annotated with what slice 1 decided; closing principle removed (duplicate of principles invariant 9).
  - [Technology candidates](../../TECHNOLOGY_CANDIDATES.md): backend, durable workflows and AI gateway rows note the slice 1 choice and ADR 0001.
  - [Working agreement](../../WORKING_AGREEMENT.md) artifact tree replaced by pointers to where the layout is documented plus when to add security/operations/schema docs.
- **Checks:** root docs 6,538 → 5,775 words (traceability 991 → 375; overview 480 → 360); all relative Markdown links resolve; no remaining references to the removed "Agent reading order" section.
- **Branch / commit:** `feature/core-slice` and `main`; commit ID from Git.
