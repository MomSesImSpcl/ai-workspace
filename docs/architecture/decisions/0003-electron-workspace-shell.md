# ADR 0003 — Electron workspace shell with an IDE-style layout

Status: accepted (2026-10-17, chosen by the user). Supersedes the stack part of [ADR 0002](0002-task-center-local-web-ui.md); its runner, cancel and API-security decisions still hold. Branch: `claude/ui-feature-suggestions-a7df7e`.

## Context

The user wanted a desktop app now, laid out like a reference IDE-style workspace: titlebar, toolbar with breadcrumb, project sidebar, main content, right utility rail with drawers. The browser UI could not open a native folder dialog, so ADR 0002's version used per-OS scripts.

## Decision

- **Shell:** Electron 44 (`app/desktop/main.mjs`, dev dependency; `npm run desktop`, or the `AI Workspace.cmd` / `AI Workspace.command` launchers). Main starts the existing UI server with the system `node` (`ws ui --port 0`), so runners stay Node processes, and shows its page in a window with a hidden native titlebar (window controls drawn over ours on Windows/Linux). Closing the window stops the server only; tasks keep running.
- **Native surface:** one preload IPC call, `pickFolder` (Electron's dialog). The per-OS picker scripts were deleted. Renderer: context isolation, sandbox, no Node; navigation limited to the local server; other links open in the system browser; CSP on the page.
- **Layout and scope (agreed):** Workspace window only. Pages: project Overview (metrics from real task data) and Tasks (composer, list, detail). Rail tools that work today: Projects (switch, add) and Settings (role → agent, new `POST /api/roles`). Sidebar collapse, page and project are remembered per user (localStorage). Dark theme only; system font fallbacks, no bundled fonts.
- **Kept:** the local HTTP API (the window uses it; tests cover it). `ws ui` still serves it to a browser, but without a folder dialog.

## Rejected

- Chats window now: needs interactive conversations the core lacks; embedded terminals would bypass the broker (no scope, audit or budget).
- Placeholder rail tools (Files, Skills, MCP, Help) and empty page types (wiki, board, report, file preview): no data behind them yet.
- Running the server inside Electron's main process: runners would be spawned by the Electron binary.
- Tauri: adds a Rust toolchain and a different webview per OS to test; smaller app size did not matter for a personal tool.

## Known limits

[#13](https://github.com/MomSesImSpcl/ai-workspace/issues/13) needs `node` on PATH; plus [#11](https://github.com/MomSesImSpcl/ai-workspace/issues/11), [#12](https://github.com/MomSesImSpcl/ai-workspace/issues/12) from ADR 0002.
