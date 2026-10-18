# Prompt-cache awareness and cold-session cost control

**Status:** not-started

An idle agent process spends no tokens, but the provider's prompt cache expires after a few minutes. The next message then re-bills the whole conversation at full input price, so long chats get expensive after a pause. The workspace tracks when each session's cache goes cold, warns shortly before, asks before a costly send to a cold cache, and lets the orchestrator choose between continuing a session and starting fresh with a handoff. An optional onboarding step explains this and records each agent's cache lifetime.

[Full requirements](SPEC.md).

**Dependencies / related features:** [sessions](../sessions/SUMMARY.md), [onboarding](../onboarding/SUMMARY.md), [task-runtime](../task-runtime/SUMMARY.md), [ai-orchestrator](../ai-orchestrator/SUMMARY.md), [notifications](../notifications/SUMMARY.md).
