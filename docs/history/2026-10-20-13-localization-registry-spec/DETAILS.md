# 2026-10-20: localization-008–019 specified

Scope: [localization](../../features/localization/SPEC.md), from the user's file `LOCALIZATION_UPDATED_SPEC.md`. Documentation only; nothing is authorized for implementation.

## Outcome

- `SPEC.md`: the uploaded spec body, without its instruction preamble. The existing text (Problem, Scope, localization-001–007, non-goals, open decisions, first six acceptance checks) was identical on `main`, so the change only adds content: localization-008–019, an illustrative example and record shape, more non-goals and open decisions, nine acceptance checks, and "Integration and ownership".
- `SUMMARY.md`: one sentence on the registry; knowledge-retrieval and code-index added as dependencies. Status stays not-started.
- Backlinks to localization in the code-index and knowledge-retrieval summaries; traceability row and ID index (localization-001–019); progress.

## Checks

- Every referenced ID exists: `knowledge-001`, `code-index-001`, `006`, `007`, `009`, `030–039`; and so does every relative link in the changed files (script check).
- Private-data scan clean.

## Points left to the user

- localization-009 named the field "classification", while both examples use `category`; on the user's OK it now says "classification (for example a `category` field: …)".
- The first example uses `default` for the English text, the record shape `sourceText`. Both are marked illustrative.
- The new open decisions (where metadata is stored, static-analysis hooks per language, an optional "Find UI text" panel, stored or derived review status) remain open.
