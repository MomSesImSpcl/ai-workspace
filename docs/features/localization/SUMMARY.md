# Interface languages and localization

**Status:** not-started (the UI-text habits in [shared principles](../../PRINCIPLES.md#ui-text-ready-for-translation) apply now)

Lets the workspace's own interface (desktop app, later mobile, notifications, onboarding and workspace-written messages) appear in the user's language. English stays the default and the source text; agent replies are out of scope because agents already answer in the language the user writes. Covers text catalogs per language, language detection with a choice in Settings, locale-aware formats and a check that keeps new UI text translatable. The catalogs form one logical registry of user-facing text, searchable by text, meaning and context, linked to their code usages through the code index, and validated for missing, duplicate or outdated entries.

[Full requirements](SPEC.md).

**Dependencies / related features:** [desktop-client](../desktop-client/SUMMARY.md), [mobile-client](../mobile-client/SUMMARY.md), [notifications](../notifications/SUMMARY.md), [onboarding](../onboarding/SUMMARY.md), [distribution](../distribution/SUMMARY.md), [knowledge-retrieval](../knowledge-retrieval/SUMMARY.md), [code-index](../code-index/SUMMARY.md).
