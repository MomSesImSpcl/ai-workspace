# Orchestrator branch: testing and polish, merged

After the user tested the orchestrator in the app, the branch got:

- **Task details:** one bubble per run (Pause/Resume joins its run), a steps foldout with the running step in blue, live token counts with a breakdown on hover, and the model, start and finish times.
- **Chat:** the task card is a thread with its reply field, which goes directly to the task's agent; Markdown rendering (HTML-safe); requests grouped with their replies; the session's token total in the header.
- **Orchestrator:** short task titles, `rename_task`, goals sized to the task, user instructions in Settings, a task permission menu (default `acceptEdits`).
- **Tasks page:** per-session list with a grouped Project or Global view; the taskbar blinks while a task waits for approval.
- **Performance:** caches cut one refresh from about 1.4 s to 0.2 s on the user's storage.
- **Restart:** the app starts the new instance itself and ends a hung old one.

Specified, not built: [large-storage](../../features/large-storage/SUMMARY.md) (scale-001–006), sessions-027 (scroll position), Plan Mode (orchestrator-007), [agent-permissions](../../features/agent-permissions/SUMMARY.md). Tests 48/48, CI green. See [details](DETAILS.md).
