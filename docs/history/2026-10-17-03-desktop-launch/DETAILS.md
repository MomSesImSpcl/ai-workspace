# 2026-10-17 — Desktop launch improvements

**Scope:** user request for a better way to open the desktop UI (Windows).

**Outcome:**
- `AI Workspace.cmd`: rewrites `AI Workspace.lnk` in the Start menu Programs folder and on the Desktop on every run (targets `electron.exe` with the app folder, so a moved repository stays valid). If `electron.exe` is still missing after `npm install`, runs `node_modules/electron/install.js`.
- `app/desktop/main.mjs`: single-instance lock (second launch restores and focuses the window); explicit AppUserModelID and window relaunch details on Windows for taskbar pins.

**Checks (Windows 10, Node 24, npm 11.19):** fresh worktree: first run of the launcher left `electron.exe` missing after `npm install` (pre-existing bug); after the fix, deleting `node_modules/electron/dist` and running the launcher fetched the binary and opened one "AI Workspace" window. Both shortcuts point to `electron.exe` with the app folder. Starting the Start menu shortcut while the app ran did not add Electron processes. Not checked: pinning to the taskbar and relaunching from the pin; macOS/Linux launchers unchanged.

**Commit:** see branch `claude/ui-feature-suggestions-a7df7e`.
