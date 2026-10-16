# 2026-10-17 — Electron workspace shell (desktop-client)

**Scope:** [desktop-client 2.1](../../features/desktop-client/SPEC.md#21-desktop-client); decision [ADR 0003](../../architecture/decisions/0003-electron-workspace-shell.md). Agreed with the user: Workspace window only; Overview + Tasks pages; only working rail tools; Electron only (per-OS picker scripts removed).

**Outcome:**
- `app/desktop/main.mjs`, `app/desktop/preload.cjs`: Electron shell, system-Node UI server on a free port, native folder dialog.
- `app/src/ui.html`: new layout (titlebar, breadcrumb toolbar, project sidebar, Overview with metrics, Tasks with composer/list/detail, Projects and Settings drawers, collapsible sidebar, remembered preferences).
- `app/src/ui.ts`: `POST /api/roles`, `integrations` in `/api/meta`; `/api/pick-folder` and `app/src/folder-picker.ts` removed.
- `app/src/cli.ts`: `ws ui` prints the actual port (supports `--port 0`).
- Launchers renamed to `AI Workspace.cmd` / `AI Workspace.command`; CI skips the Electron binary download.

**Checks (2026-10-17, Windows 10, Node 24, Electron 44.8.0):** `npx tsc` clean; `npm test` 17/17 (roles API added). Browser pane at 1280×800: Overview, Tasks with detail, Settings drawer render. Electron: window "AI Workspace" opened via `npm`/`electron .` and via `AI Workspace.cmd`; captured screenshot showed the layout with native window controls; closing the window stopped the UI server.

**Not covered:** macOS/Linux not run; native folder dialog in Electron not clicked through; no Chats window; narrow/mobile layouts only partly (sidebar shrinks at 1100px, drawer floats under 900px; window min width 760px).

**Open limits:** [#13](https://github.com/MomSesImSpcl/ai-workspace/issues/13), [#11](https://github.com/MomSesImSpcl/ai-workspace/issues/11), [#12](https://github.com/MomSesImSpcl/ai-workspace/issues/12).
