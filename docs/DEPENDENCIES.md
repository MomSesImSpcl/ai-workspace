# Dependency inventory

Everything the workspace needs to build, run or develop, kept current during development. It is the input for the [distribution feature](features/distribution/SPEC.md) (prerequisite check, installer, support matrix). Add a row when work introduces or drops a dependency, with the version it was tested with; `npm` packages are pinned in `app/package-lock.json`, so list them here only by purpose.

## Runtime prerequisites (not installed by `npm install`)

| Dependency | Needed for | Required version | Last tested | Install / setup | OS notes |
|---|---|---|---|---|---|
| Node.js | Everything: CLI, UI server, task runners (runs TypeScript directly via type stripping) | ≥ 24 | 24 on Windows 10 | [nodejs.org](https://nodejs.org/) | Must be on `PATH` for the desktop app ([#13](https://github.com/MomSesImSpcl/ai-workspace/issues/13)) |

## Agent integrations (optional, user's choice)

The user assigns any agent to any role ([routing-001](features/model-routing/SPEC.md#role-and-agent-assignments)), so no agent CLI is a direct dependency. Only the integrations assigned to roles that are actually used must be installed and logged in; at least one runnable integration is needed to run tasks. A prerequisite check should test the assigned ones and mark the rest optional.

| Integration | Default role | Last tested | Install / setup | Notes |
|---|---|---|---|---|
| Claude Code CLI (`claude`) | `Implementation` | 2.1.301 (2026-10-17) | Install per [docs](https://docs.anthropic.com/en/docs/claude-code), then `/login` with a Claude subscription (quota) | Real runs Windows-only so far ([#10](https://github.com/MomSesImSpcl/ai-workspace/issues/10)) |
| Codex CLI (`codex`) | `Orchestration` | 0.163.0 installed (2026-10-17) | `npm install -g @openai/codex`; one-time `codex login` (Sign in with ChatGPT, subscription quota) with `CODEX_HOME=~/.ai-workspace/codex` | Windows bypasses the npm `.cmd` shim |
| `manual-browser` | `ArchitectureReasoning` | — | Nothing to install; no runnable adapter yet | Manual handoff |

## npm packages (`app/package.json`, pinned in the lockfile)

| Package | Kind | Purpose |
|---|---|---|
| `@modelcontextprotocol/sdk` | runtime | Workspace MCP server: the broker's scoped file and delegate tools |
| `zod` | runtime | MCP tool input schemas |
| `electron` | dev (desktop app) | Desktop window, native folder dialog; 44.8.0 tested on Windows 10. Downloads a ~100 MB binary on install (CI skips it with `ELECTRON_SKIP_BINARY_DOWNLOAD=1`) |
| `typescript` | dev | `npm run typecheck` only; no build step |
| `@types/node` | dev | Node typings for the typecheck |

## Platform pieces used by the app

| Piece | Used by | OS notes |
|---|---|---|
| Electron's bundled Chromium | Desktop window | Linux may need the usual Chromium system libraries; untested |
| Loopback TCP port (random, or 4317 for `ws ui`) | Local UI API | Bound to `127.0.0.1` only |
| Workspace home `~/.ai-workspace` (or `AI_WORKSPACE_HOME`) | Projects, tasks, audit, roles, Codex login | Must be writable |

## Development only

| Tool | Purpose |
|---|---|
| Git | Version control, branches per feature |
| GitHub CLI (`gh`) | Issues (`known-limit`), PRs |
| GitHub Actions | CI on Ubuntu, Windows, macOS with Node 24; private-data scan |
