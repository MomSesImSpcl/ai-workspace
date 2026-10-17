# Chat sessions and project structure

**Status:** not-started (the desktop app's interim chat column treats each chat as a task; see [SPEC.md](SPEC.md#relation-to-the-interim-chat-as-task-build))

Each project has its own chat sessions, like separate chats in Claude or ChatGPT: own history, kept apart from other projects. A session is a live conversation with an agent that can start delegated tasks; each task links back to its session. Defines the project → session → task structure, the session list, live activity in the chat (collapsed on success, kept on cancel, failure or interruption), and what closing the app does to replies and running tasks.

[Full requirements](SPEC.md).

**Dependencies / related features:** [identity-projects](../identity-projects/SUMMARY.md), [task-runtime](../task-runtime/SUMMARY.md), [desktop-client](../desktop-client/SUMMARY.md), [model-routing](../model-routing/SUMMARY.md), [memory](../memory/SUMMARY.md).
