# 2026-10-17 — Project archive

**Decision (user):** "unlink" only, which equals archive; no delete inside the workspace, so a project folder can never be removed from the computer by the app.

**Files:** `app/src/store.ts` (`archived` on projects, `setProjectArchived`), `app/src/ui.ts` (`POST /api/projects/<id>/archive`; project ids are URL-decoded and may contain spaces, task and session ids stay `[\w-]+`), `app/src/ui.html` (project menu shared with the session menu code, Show archived on the Projects page, archived projects not selectable, confirm dialog resolves on submit/cancel). Test in `app/test/sessions.test.ts`.

**Checks:** `npm test` 31/31, `npx tsc` clean; in the browser pane: archive with confirmation hid the project, Show archived listed it, Restore returned it. Not checked in the Electron window.

**Branch:** `claude/chat-sessions-per-project-f82af3`.
