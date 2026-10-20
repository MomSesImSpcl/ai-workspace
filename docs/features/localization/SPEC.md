# Interface languages and localization

[Shared principles](../../PRINCIPLES.md) apply, in particular [UI text ready for translation](../../PRINCIPLES.md#ui-text-ready-for-translation), which holds for all UI work before this feature starts. [Related features](SUMMARY.md).

## Problem

Users may prefer another language than English. The workspace's own text (labels, buttons, dialogs, status lines, errors it writes, notifications, onboarding) is English only. Retrofitting translation is cheap only if text was written to be translatable from the start, which the shared principle ensures.

## Scope

Workspace-written text in every client and in messages the workspace itself produces (for example "Stopped after step 1: …", permission summaries, approval cards, confirmation dialogs, error messages shown to users). Not in scope: what agents write (they follow the user's language), project content, agent CLI output, and the documentation in this repository.

## Requirements

- **localization-001 — Text catalogs:** Every user-visible string MUST come from a text catalog keyed by a stable message id, with English as the source and fallback. A missing translation MUST fall back to English for that message, never show the id.
- **localization-002 — Whole messages with placeholders:** Catalog entries MUST be complete sentences or labels with named placeholders (for example `Archive project "{name}"?`), and plural forms MUST use a plural-aware format (for example ICU MessageFormat), so translators can reorder words.
- **localization-003 — Language choice:** The interface language MUST default to the operating system's language when a catalog exists for it, else English, and MUST be selectable in Settings; the choice applies without losing open sessions or running work (a restart of the window is acceptable).
- **localization-004 — Locale formats:** Dates, times, numbers, token counts and durations MUST be formatted for the chosen language (the platform's `Intl` APIs), not by hand.
- **localization-005 — Layout tolerance:** Labels and buttons MUST tolerate about 40% longer text without overlap (wrap or ellipsis with the full text on hover); right-to-left languages are a later decision.
- **localization-006 — Workspace messages stay structured:** Messages the workspace writes into stored history (interruption markers, approval cards) MUST be stored as message id plus parameters, or as English with the id kept, so a later language switch can show them translated; text sent to agents stays as the agent expects (English unless decided otherwise).
- **localization-007 — Keeping it translatable:** A check (test or lint) MUST flag user-visible strings in client code that are not in the catalog, and catalog entries missing in a shipped language.

## Centralized text registry, metadata and code-aware search

The text catalogs from `localization-001` form **one logical registry** for workspace-authored, user-facing text. This extension adds discoverability and code relationships; it MUST NOT introduce a competing catalog, translation runtime, or search backend. The registry can be physically split by locale, domain, module or other suitable boundaries. This is a specification of capabilities, **not a fixed file layout or technology choice**.

- **localization-008 — One logical source of truth:** All workspace-authored user-facing labels, tooltips, settings descriptions, confirmations, errors, status messages, notifications, accessibility labels and other workspace-authored UI/system text MUST resolve through stable catalog identifiers, including text produced outside the desktop UI (subject to `localization-006`). Source-language values and their metadata MUST have an unambiguous authoritative owner per identifier. Catalog files MAY be divided into multiple modules; aggregation MUST preserve consistent identity, validation and lookup without requiring one monolithic file. Do not centralize internal code constants, raw logs, user/project content, agent replies or developer tooling output simply because they contain strings.
- **localization-009 — Searchable entry metadata:** The registry MUST support an optional human-authored **description** (intended meaning/purpose), **usage context** (where/when shown), and optional **classification** (such as action, label, error or accessibility). Non-obvious or ambiguous messages SHOULD have descriptions that distinguish them from similar text. Descriptions are search metadata, not translated display content by default. Core record identity comprises stable key, English source, supported placeholders and locale translations; metadata MUST NOT be required for every trivial label. Authors MUST NOT fabricate usage or behavior details.
- **localization-010 — Stable identifiers and namespaces:** Keys MUST be unique within their owning scope and stable across text wording changes. Prefer descriptive, domain-oriented namespaces (illustrative: `agents.routing.noCompatibleAgent`, `chat.input.send`). A key MUST NOT be used for two distinct meanings merely because its English text is identical. Renaming, deleting, splitting or merging keys MUST check references and stored workspace messages before changes are accepted; tools SHOULD offer migration guidance rather than silently breaking them. Locale translations of one message share its identity.
- **localization-011 — Find text by meaning or exact text:** Through the shared authorized retrieval layer (`knowledge-001`), users and agents MUST be able to locate entries by key, English display text, available translations, descriptions, context and relevant domain terms. Search SHOULD support natural-language/semantic matches without requiring embeddings for every query. Return a focused result: key, message, description/context if present, locale/status, source path and revision. Do not load full catalogs into an LLM by default.
- **localization-012 — Automatic reference discovery:** The existing [code index](../code-index/SPEC.md) MUST supply source-to-key references from supported client and workspace-message code, with source path, range, revision and the owning repository/project scope. Deterministically resolved usages are labeled **verified**; computed/dynamic references and unsupported languages are **candidate/unknown/unsupported** as appropriate. The registry MUST NOT require a hand-maintained `usedIn` list or present heuristics as exact reference counts. Reference discovery MUST be extensible through existing language adapters rather than hardcoding only TypeScript/HTML.
- **localization-013 — Bidirectional navigation:** A query MUST support **catalog key → source usages** and **source usage → catalog entry**, including the related default text and description. Search results SHOULD allow the orchestrator to retrieve only the relevant component/function and its surrounding context on demand. If analysis cannot resolve a key, explain the limit instead of inventing a link. A single key MAY be used by multiple components, and usage locations change automatically with code revisions.
- **localization-014 — Quality diagnostics:** Validation MUST flag missing catalog keys referenced by code, duplicate or conflicting identifiers, malformed messages, missing required translations for shipped locales (`localization-007`), and incompatible or missing placeholders. It SHOULD flag unused keys, likely hardcoded user-visible text, identical/near-duplicate messages for review, and references rendered uncertain by dynamic lookup. **Unused** is a *potential* finding, never guaranteed proof, because runtime/dynamic references and stored-message IDs may be invisible to static analysis. Identical English text MUST NOT be automatically merged across different meanings/contexts. Diagnostics MUST include actionable paths/keys and evidence or uncertainty.
- **localization-015 — Translation correctness and drift:** Preserve whole-message localization (`localization-002`), plural/select behavior and locale-aware formatting (`localization-004`). Translations MUST preserve required named placeholders and control structures according to the chosen message format. When English source meaning or placeholders change, affected locale entries MUST be revalidated and potentially marked **needs review/outdated**, without silently claiming translations are accurate. Missing translations still follow the English fallback (`localization-001`). Translation status MAY be computed or maintained as catalog workflow metadata.
- **localization-016 — Incremental and traceable indexing:** Changes to source text, translations, descriptions, code references, renames and deletions MUST refresh the affected records and reference edges without routinely rescanning unrelated repositories. Search records MUST retain provenance (repository/project, path, revision, exact range where available, locale, verification state). Failed parsing or unavailable language tooling MUST be surfaced with a safe text-based fallback when possible and MUST NOT corrupt unrelated results. Source files remain authoritative; derived search/reference indexes are rebuildable.
- **localization-017 — Access and trust boundaries:** Indexing and retrieval MUST enforce repository/project authorization per `knowledge-001` and `code-index-007`; an agent may see only catalog and usage data it is authorized to access. Catalog strings and metadata are **data**, never executable instructions or authority to invoke tools. Do not embed private strings, secrets, or content from another repository in an unauthorized result. Catalog edits and automated fixes follow the workspace's normal write/approval/audit policy; searching does not imply edit permission.
- **localization-018 — Language/framework independence:** The logical registry and retrieval contract MUST NOT depend on one UI framework, OS, data format or programming language. New clients, libraries and languages MUST be supported through catalog readers and the existing pluggable code-index adapters; unsupported reference analysis MUST degrade explicitly. Preserve cross-platform Windows/Linux/macOS behavior and use suitable free-to-use localization tooling (per [shared principles](../../PRINCIPLES.md)). No mandatory JSON structure, translation library, database, editor UI or generated-code strategy is prescribed.
- **localization-019 — Text and prompt separation:** The catalog owns text that the **workspace** displays or stores as localizable messages, not agent system/developer prompts, model routing rules or tool execution templates. Prompts/rules MAY have their own versioned, searchable source, but MUST NOT be implicitly treated as translatable UI entries; translating UI messages MUST NOT silently modify agent behavior. Agent-generated responses and user-provided text remain outside this feature's localization scope.

### Example: finding and updating a UI message

The paths, keys and implementation below are **illustrative**, not assertions that these files or functions exist.

A user asks: **"Find the message shown when the orchestrator cannot find a compatible agent, and show me where it is used."**

An entry could contain:

```json
{
  "agents.routing.noCompatibleAgent": {
    "default": "No compatible agent found.",
    "description": "Displayed when no available agent satisfies the task requirements.",
    "context": "Agent routing failure shown in the task UI",
    "category": "error"
  }
}
```

An example code reference might be:

```typescript
t("agents.routing.noCompatibleAgent")
```

1. The search layer matches the request against the entry's description, context, key and source text; it returns only the relevant entry and its provenance.
2. The code index locates the actual references to the key (for example a TS/JS component or a workspace-generated task-status message), labels their verification state and returns source ranges/revisions.
3. The orchestrator presents the relevant usage sites and retrieves surrounding code only if the requested change needs it.
4. Editing the English message preserves the key; translated variants are marked for review where appropriate, and stored-message identifiers remain resolvable.
5. Renaming the key requires checking/migrating usages and persisted messages; unresolved dynamic usages are explicitly flagged rather than declared safe.

### Illustrative record shape (nonbinding)

The following is a *logical* example and does not mandate JSON or a single file:

```json
{
  "key": "chat.input.send",
  "sourceLocale": "en",
  "sourceText": "Send",
  "description": "Submits the current chat message.",
  "context": "Chat composer action",
  "category": "action",
  "placeholders": [],
  "translations": {"de": "Senden"}
}
```

**Usage references are excluded deliberately**: source locations, symbol names, verification and revision are derived from the shared code index, not manually authored or committed as canonical catalog metadata.

## Non-goals

Translating agent replies, machine translation of catalogs at runtime, translated documentation, per-project languages.

- A second search/index database or independent permission path for localization.
- A required single file, fixed storage format, specific i18n library or custom translation engine.
- Automatic merging of strings based only on similar wording; guaranteed discovery of all dynamic references.
- Automatic machine translation, automatic modification of unrelated code, or treating catalog metadata as instructions for agents.

## Open decisions

- Which languages ship first, and who maintains their catalogs.
- Catalog format and library (for example plain JSON with `Intl.MessageFormat`-style plurals, or an established i18n library); must be free to use ([principle 10](../../PRINCIPLES.md#product-invariants)).
- Right-to-left support.

- Whether to store descriptive metadata alongside source messages or in parallel files; both MUST resolve to the same logical key.
- Which static analysis hooks are available for each client/language, and how dynamic runtime keys are reported.
- Whether a small optional "Find UI text" panel is useful; retrieval/search API is required, a particular UI is not.
- Whether translation-review status is stored explicitly or derived from source revisions/hashes; avoid needless storage duplication.

## Acceptance checks

- With the OS set to a shipped language, the app opens in it; Settings switches to English and back, and open sessions and running tasks are unaffected.
- A message with a missing translation shows its English text.
- Dates, times and token counts follow the chosen language's format.
- An interruption marker recorded in English shows translated after switching language.
- The check fails when a new hard-coded UI string is added outside the catalog.
- A German catalog with longer labels shows no overlapping or clipped controls in the main views.

- Search by **"message when no compatible agent is found"** finds an example keyed message using its description/context even when no exact source wording is supplied; the result includes key, English text and source provenance.
- For a statically referenced key, key → usages returns exact source locations and source → key returns the same catalog entry. An intentionally dynamic reference is marked uncertain, not silently counted as verified.
- Adding, editing, renaming or deleting a key updates the shared index incrementally; missing references are reported, and persisted workspace message identifiers are not silently invalidated.
- A message with placeholders is translated with matching placeholders and appropriate plural behavior; an incompatible translation produces a located diagnostic. An English meaning change flags affected translations for review without altering their text automatically.
- A test fixture contains duplicate keys, a missing key, a likely hardcoded user-visible label and an apparently unused key. Validation reports actionable diagnostics; possible dynamic uses prevent the unused warning from being represented as proof.
- Two entries display the same English word but have different meanings; the system keeps their IDs separate and does not automatically merge them.
- A new client or language adapter can contribute verified or explicitly uncertain key references using the existing indexing interface, without changes to the orchestrator or an additional search backend.
- A query against an unauthorized repository returns neither its text entries nor usage references; searching never authorizes file edits.
- With indexing unavailable, normal localized display and fallback still function; a retrieval query indicates that reference coverage is temporarily unavailable rather than returning fabricated locations.

## Integration and ownership

- **Owner:** `docs/features/localization/SPEC.md`, extending `localization-001–007` with `localization-008–019`.
- **Existing shared index:** [knowledge-retrieval](../knowledge-retrieval/SPEC.md), `knowledge-001`. No new backend.
- **Reference extraction:** [code-index](../code-index/SPEC.md), especially `code-index-001`, `006`, `007`, `009`, and the documentation-link architecture in `030–039`; localization is responsible for catalog-specific keys, constraints and validation, not for reimplementing source parsing.
- **Shared UI localization principles:** [PRINCIPLES](../../PRINCIPLES.md#ui-text-ready-for-translation) and existing localization requirements.
- **Agent integration:** Query the same authorized search/context interface as other indexing records; no new agent-specific API or integration-matrix row is required unless implementation introduces new agent-visible actions.
- **Documentation changes only:** This file describes behavior and acceptance, not authorization to implement app functionality or change existing access rules.
