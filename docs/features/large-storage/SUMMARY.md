# Responsive workspace with large storage

**Status:** not-started (specified 2026-10-18 at the user's request)

The workspace stays fast as conversations, tasks and projects grow. The page loads only the recent part of a long session, with older parts on demand. Session and task lists come from small summaries, not from reading every log. Updates carry only what changed, and memory use stays bounded. A generator creates large synthetic storage, so speed is measured against agreed numbers instead of guessed.

[Full requirements](SPEC.md).

**Dependencies / related features:** [sessions](../sessions/SUMMARY.md) (event logs, chat), [task-runtime](../task-runtime/SUMMARY.md) (task lists), [desktop-client](../desktop-client/SUMMARY.md) (page, Task Center), [workspace-transfer](../workspace-transfer/SUMMARY.md) (storage layout).
