# 2026-10-17 — Layout: Projects page, sessions column, chat agent from Settings

**Scope:** user request; [desktop-client 2.1](../../features/desktop-client/SPEC.md#21-desktop-client), [sessions-004](../../features/sessions/SPEC.md#session-list-and-lifecycle) (list beside the open session).

**Outcome (`app/src/ui.html`, `app/src/roles.ts`, `app/desktop/main.mjs`, `app/desktop/preload.cjs`):**
- Sessions column: New session, search, "Show archived", the full-height scrollable list, and a line naming the agent new sessions use. The sidebar toggle hides it together with the chat.
- Projects page replaces Overview: one card per project (path, tasks, running, work tokens), click selects it; add-project form on the page; the Projects drawer and rail button removed; "Switch" in the chat header opens the page.
- Tasks stay per project (they already carry `projectId`); the Tasks page shows the selected project's tasks.
- New `Chat` role (default `claude-code`) in Settings decides the agent for new sessions; the chat no longer has an agent picker.
- Breadcrumb project name: tooltip with the folder path; in the desktop app a click opens the folder via a new `openFolder` preload call. Main only opens existing directories.

**Checks:** `npx tsc` clean, `npm test` 29/29; UI checked in the browser pane at narrow width and at 1280×800 (Projects page, sessions column, chat). Not checked: the Electron window and the open-folder click (needs the desktop app).

**Branch:** `claude/chat-sessions-per-project-f82af3`.
