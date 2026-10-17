# 2026-10-17 — Sessions feature specified

**Scope:** user request to specify the chat/project structure: individual chat sessions per project, like Claude and ChatGPT, separate between projects.

**Agreed with the user:** sessions per project (sessions-001); live activity shown while working, collapsed (not deleted) on success, kept expanded with a last-step marker on cancel, failure or interruption (sessions-007/008); resuming relies on durable state, with the marker passed to the agent (sessions-009); closing the app finishes in-flight replies, keeps tasks running by default and asks Keep running / Cancel all with "Don't ask again" changeable in Settings, plus a visible indicator after close (sessions-011–013). The interim chat-as-task build is superseded.

**Open decisions recorded in the spec:** chats without a project, agent per session, shared project context, session budgets/write permission, adapter support for streaming and stop.

**Outcome:** `docs/features/sessions/SUMMARY.md` and `SPEC.md` (sessions-001–013, acceptance checks); linked from the overview, traceability ID index, desktop-client and task-runtime summaries.

**Checks:** local links checked; no application change.

**Commit:** see branch `claude/ui-feature-suggestions-a7df7e`.
