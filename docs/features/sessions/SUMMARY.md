# Chat sessions and project structure

**Status:** in-progress — slice 1 built: per-project sessions with durable history, live activity, Stop, Claude Code approval cards (sessions-001–008, 010, 018–020, 025; sessions-002 tasks started from a chat; [ADR 0005](../../architecture/decisions/0005-session-turn-runner.md)); the rest is not started.

Each project has its own chat sessions, like separate chats in Claude or ChatGPT: own history, kept apart from other projects. A session is a live conversation with an agent that can start delegated tasks; each task links back to its session. Covers the session list, live activity (collapsed on success, kept on interruption), close behavior, a General space, switchable agents, three rule layers (project over workspace over global), agent-native permissions with approval cards, live usage and a cost-estimate range.

[Full requirements](SPEC.md).

**Dependencies / related features:** [identity-projects](../identity-projects/SUMMARY.md), [task-runtime](../task-runtime/SUMMARY.md), [desktop-client](../desktop-client/SUMMARY.md), [model-routing](../model-routing/SUMMARY.md), [memory](../memory/SUMMARY.md).
