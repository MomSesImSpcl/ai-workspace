# Performance groundwork and the large-storage spec

Switching sessions was slow: each page refresh re-read every session file and log, several times per request, and refreshes piled up. Measured on a copy of the user's storage (29 sessions, 74 MB), then fixed:

- parsed session files and logs are cached, and logs are read incrementally;
- the session list is built once per page request;
- a refresh never starts on top of a running one;
- the page refreshes every second.

| Request | Before | After |
|---|---|---|
| Session list | 577 ms | 53 ms |
| Task list | 339 ms | 64 ms |
| Largest session | 436 ms | 65 ms |

The lasting fix for large storage is specified as [large-storage](../../features/large-storage/SUMMARY.md) (scale-001–006): a synthetic-storage generator, list summaries, recent turns first, change-only refreshes, bounded memory. Not built. See [details](DETAILS.md).
