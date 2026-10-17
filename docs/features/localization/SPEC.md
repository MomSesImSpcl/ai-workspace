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

## Non-goals

Translating agent replies, machine translation of catalogs at runtime, translated documentation, per-project languages.

## Open decisions

- Which languages ship first, and who maintains their catalogs.
- Catalog format and library (for example plain JSON with `Intl.MessageFormat`-style plurals, or an established i18n library); must be free to use ([principle 10](../../PRINCIPLES.md#product-invariants)).
- Right-to-left support.

## Acceptance checks

- With the OS set to a shipped language, the app opens in it; Settings switches to English and back, and open sessions and running tasks are unaffected.
- A message with a missing translation shows its English text.
- Dates, times and token counts follow the chosen language's format.
- An interruption marker recorded in English shows translated after switching language.
- The check fails when a new hard-coded UI string is added outside the catalog.
- A German catalog with longer labels shows no overlapping or clipped controls in the main views.
