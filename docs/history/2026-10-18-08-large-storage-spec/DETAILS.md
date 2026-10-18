# 2026-10-18 — Performance groundwork, large-storage spec

## Measurement

The real storage was copied into a scratch folder. A script timed the page's requests through the UI server, cold and warm. A CPU profile showed the time in `existsSync`, `statSync` and file reads: every chat in the list listed all sessions to find its tasks, every task did it again for its subtasks, and every log was parsed again on each refresh.

## Changes (branch `claude/orchestrator-2bfd92`)

- `app/src/sessions.ts`:
  - `readEvents` keeps parsed logs and reads only appended bytes; a half-written last line waits for the next read.
  - `loadSession` reuses a parsed file while its size and modification time are unchanged.
  - `allSessions` is built once per page request (`forgetSessionList` at the start of each request in `ui.ts`). Elsewhere it is kept for 0.5 s, and a write in the same process clears it.
- `app/src/ui.html`: a refresh does not start while one runs; the interval is now 1 s.
- Test: a cached log picks up appended events, waits for a half-written line and survives a shorter rewrite.

## Results (warm, server time)

Session list 577 → 53 ms; task list 339 → 64 ms; largest session (69 KB of events) 436 → 65 ms. 48/48 tests pass.

## Known limit

A log replaced by a longer one in the same process lifetime would be misread (a `shortcut:` comment in `readEvents`); nothing rewrites logs today.
