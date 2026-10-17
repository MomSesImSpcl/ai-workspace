# 2026-10-17 — Workspace folder

**Decision (user):** one workspace, one optional root folder; projects outside it allowed (alternatives rejected: several workspaces; projects required inside the root).

**Files:** `app/src/store.ts` (`getWorkspaceRoot`, `setWorkspaceRoot`: absolute, existing folder), `app/src/ui.ts` (`/api/meta` returns `workspaceRoot`, `POST /api/workspace`), `app/desktop/main.mjs` and `preload.cjs` (`pickFolder(title, start)` with `defaultPath`), `app/src/ui.html` (Settings field with picker, picker start folder, breadcrumb). Test in `app/test/sessions.test.ts`.

**Checks:** `npm test` 30/30, `npx tsc` clean. Not checked: the native dialog opening in the root, and the breadcrumb click (desktop window only).

**Branch:** `claude/chat-sessions-per-project-f82af3`.
