# Responsive workspace with large storage

[Shared principles](../../PRINCIPLES.md) apply. [Summary and dependencies](SUMMARY.md).

## Starting point (measured 2026-10-18)

Storage is files: one JSON file per session or task and an append-only event log (`sessions-003/020`). The server keeps parsed files and logs in memory once read, and it builds the session list once per request. The page refreshes every second. Each refresh fetches the open session's full history, the session list and the task list, and the lists are computed by folding every log.

On a copy of the user's storage (29 sessions, 74 MB), one refresh costs about 0.2 s of server time:

- project session list 53 ms
- task list 64 ms
- largest session (69 KB of events) 65 ms

Costs grow with the total history and with the number of tasks per chat.

## Requirements

- **scale-001 — Large synthetic storage:** A script MUST generate a scratch storage of a chosen size: projects, chat sessions with N turns each (text, activity, approvals, usage), and tasks with runs and subtasks. It MUST never touch the user's real storage. A measurement script MUST time the requests the page makes (list, open session, task list, task details, one refresh) against that storage and report them per size.
- **scale-002 — Summaries for lists:** Session and task lists MUST be built from a small summary per session and task, kept up to date by every write that changes what a list shows:
  - title, state, pending approvals, token totals, last activity, and the chat that started a task.

  A list request MUST NOT read event logs. A summary that is missing or older than its log MUST be rebuilt from the log; the log stays the source of truth.
- **scale-003 — Recent turns first:** Opening a session MUST return only its most recent turns (a fixed number, for example 50) and the total count. The page MUST offer "load older", which fetches the previous block without moving what the user is reading. The task thread inside a chat follows the same rule. A remembered scroll position in older turns ([sessions-027](../sessions/SPEC.md)) loads the blocks it needs.
- **scale-004 — Only what changed:** A refresh of an open session MUST transfer only events after the last one the page has (a cursor), not the whole history. Pushing events over a live connection instead of polling MAY replace this, if it keeps the same guarantees after a restart.
- **scale-005 — Bounded memory:** The server's in-memory cache of parsed logs MUST have a size limit and drop the least recently used logs first. Dropped logs are read again when needed.
- **scale-006 — Rendering:** The page MUST stay responsive with a long visible chat: rendering one refresh MUST NOT redo the work for unchanged turns. Showing only the visible turns MAY be added if measurement shows it is needed.

## Acceptance

Measured with scale-001 on the user's development computer, warm (after the first request), server time:

| Storage | Open session | Session list | Task list | One page refresh |
|---|---|---|---|---|
| 1 session with 5,000 turns | under 200 ms | — | — | under 100 ms |
| 1 project with 200 chats | — | under 100 ms | — | — |
| 1 project with 500 tasks (with subtasks) | — | — | under 100 ms | — |
| all three together, 1 GB of logs | under 200 ms | under 100 ms | under 100 ms | under 300 ms |

Other checks:

- "Load older" in a 5,000-turn session shows the previous turns without the view jumping.
- The server's memory stays under the configured cache limit plus a fixed base.
- After a crash during a write, the lists still show correct data: summaries are rebuilt from the logs.

The numbers are first targets agreed with the user; change them here when measurement shows a reason.

## Non-goals

- A database: files stay the storage format unless measurement against these targets shows they cannot be met.
- Changing what is sent to the agents: long-context handling for the model is [task-runtime](../task-runtime/SPEC.md) rollover and [prompt-cache](../prompt-cache/SPEC.md).
- Search across history.

## Open decisions

- Polling with a cursor (scale-004) or a live push connection.
- The size of the cache limit (scale-005), decided from the measurement.
