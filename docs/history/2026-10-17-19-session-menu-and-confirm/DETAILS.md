# 2026-10-17 — Session menu and styled confirmations

**Scope:** user request; [sessions-004/005](../../features/sessions/SPEC.md#session-list-and-lifecycle).

**Outcome (`app/src/ui.html`):** one shared menu (`role="menu"`) opened by the row's ⋯ button or right-click, closed by Escape or a click elsewhere; Rename opens the session and edits its title in place; Archive… and Delete… confirm in a `<dialog>` (Escape or Cancel aborts; Delete uses a red button and says the history cannot be restored and that tasks are kept); Restore acts at once. "Show archived" lists the archived sessions of the project, where Restore brings them back. The chat header now shows only the title (and "archived").

**Checks:** in the browser pane against a temp workspace: menu by right-click and by ⋯; Delete dialog shown and cancelled (session kept); rename from the menu saved; Archive with confirmation hid the session, Show archived listed it, Restore returned it. `npm test` 29/29. Not checked in the Electron window.

**Branch:** `claude/chat-sessions-per-project-f82af3`.
