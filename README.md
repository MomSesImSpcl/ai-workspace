# AI Workspace

A planned, project-agnostic workspace for interactive AI, durable background tasks, configurable models and authorized local/cloud tools. This repository contains the product specification, development instructions and a first prototype: a CLI with restart-safe tasks, Claude Code and Codex CLI adapters and project-scoped file tools ([core slice 1](docs/architecture/decisions/0001-core-slice-stack.md)).

## Start or continue with an agent

Read [AGENTS.md](AGENTS.md), then the [feature map](docs/OVERVIEW.md), [shared principles](docs/PRINCIPLES.md) and [current progress](docs/PROGRESS.md). To choose new work, start with feature titles and discuss them with the user; open only useful short summaries. Load full specs after agreeing on the feature set, or when the user explicitly asks for deeper analysis.

You can give an agent this instruction with the repository URL:

> Read AGENTS.md and resume from the compact docs/PROGRESS.md; search docs/history/ only for relevant past records. Follow any scope I have already selected; otherwise discuss feature titles with me, open short summaries only as needed, and help choose what to build next before loading full specs.

There is no fixed build order. The user and agent choose each feature set together, agree on a bounded outcome and acceptance checks, then implement and verify it.

## Repository guide

- [Feature map](docs/OVERVIEW.md): descriptive titles and paths to all capabilities.
- [Adding or changing features](docs/ADDING_FEATURES.md): concise specification rules and registration checklist.
- [Working agreement](docs/WORKING_AGREEMENT.md): implementation, verification and handoff rules.
- [Progress](docs/PROGRESS.md): compact current state and next action; [history](docs/history/): one folder per completed work item with a short summary and details, searched only as needed. [Architecture decisions](docs/architecture/decisions/README.md): index of ADRs. [Requirement traceability](docs/REQUIREMENTS_TRACEABILITY.md) maps requirements to status and evidence.
- [Architecture, security and quality](docs/ARCHITECTURE.md): shared contracts; [open decisions](docs/OPEN_DECISIONS.md): choices to resolve when relevant.

Each `docs/features/<feature>/` folder contains exactly `SUMMARY.md` and `SPEC.md`.

## Getting started (prototype CLI)

Tested on Windows 10 with Node 24. Each agent run uses your own Claude and ChatGPT subscription quota. **New machine:** follow the [setup order](docs/DEPENDENCIES.md#setup-order-on-a-new-machine); the steps below explain each part.

**Requirements** (not installed by `npm install`):

- [Node.js](https://nodejs.org/) 24 or newer (runs the TypeScript sources directly).
- At least one agent CLI for the roles you use (any agent can run any role, see `roles` below; full list in [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md)):
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI, logged in (`claude`, then `/login`). Used for the `Implementation` role.
- [Codex CLI](https://github.com/openai/codex) (`npm install -g @openai/codex`), only for the `Orchestration` role. It runs in a dedicated Codex home so your personal Codex rules do not steer workspace tasks; log in there once with "Sign in with ChatGPT":

  ```powershell
  New-Item -ItemType Directory -Force "$HOME\.ai-workspace\codex" | Out-Null
  $env:CODEX_HOME="$HOME\.ai-workspace\codex"; codex login
  ```

  macOS/Linux: `mkdir -p ~/.ai-workspace/codex && CODEX_HOME=~/.ai-workspace/codex codex login` (untested).

**Install and register a project folder:**

```bash
cd app
npm install
node src/cli.ts project add <project-path> --id demo
```

**Try it** (from `app/`):

```bash
node src/cli.ts run "Create hello.js that prints Hello" --project demo --write
node src/cli.ts run "Do not write files yourself. Use delegate to have the implementer create greet.js exporting greet(name). Then read it and verify." --project demo --role Orchestration --write
node src/cli.ts run "Create files f01.txt to f12.txt, one write per message" --project demo --write --budget 20000
node src/cli.ts resume <taskId> --budget 400000
node src/cli.ts status
node src/cli.ts cancel <taskId>
node src/cli.ts ui
npm run desktop
node src/cli.ts roles
node src/cli.ts roles Implementation codex
```

Optional: run `npm link` once in `app/` to type `ws ...` instead of `node src/cli.ts ...`. Without `--write` the agent can only read. Workspace state lives in `~/.ai-workspace/` (override with `AI_WORKSPACE_HOME`), laid out like the workspace: `projects/<project>/sessions` and `.../tasks`, `global/sessions`, plus `audit.jsonl` (every event and tool call). It never goes into project folders; Settings shows it and can export or import it. A killed run continues with `resume <taskId>`.

**Desktop app:** `npm run desktop` opens AI Workspace (Electron): a Projects page (add, archive, remove; subfolders of your workspace folder are offered), per-project Tasks, and on the left the sessions of the current project plus global ones (pin, drag to reorder, rename, archive, delete). A session is a chat with an agent that runs with your own setup (plugins, hooks, settings, permissions): replies stream in with live activity, your agent's "ask" rules appear as approval cards, Stop interrupts, and the composer picks the agent, model and effort from what each agent offers. One agent process serves a session, and work continues after the window closes. ⟳ in the toolbar restarts the app after code changes; next to it, "Check for updates" fetches `main` when clicked and, if there is something new, becomes "Update and restart", which brings the checkout up to date first. A restart only completes once the new version passes a short startup check; if it fails, the app shows why and offers the last working version, a copy it keeps in its storage. Or double-click `AI Workspace.cmd` (Windows) or `AI Workspace.command` (macOS; on Linux run it or allow executing it) in the repository root; the first start installs dependencies. On Windows it also adds `AI Workspace` shortcuts to the Start menu and Desktop, so later you can open it from Start search; opening it again focuses the open window. The app needs Node 24 on `PATH`. `ui` serves the same page to a browser at http://127.0.0.1:4317/, without the folder dialog.

**Develop** (from `app/`): `npm test` (unit tests), `npm run typecheck`. CI runs both on Windows, Linux and macOS and scans for private data on every push. Sources are in `app/src/`, tests in `app/test/`.

On Windows, `.ts` files may be associated with a video player; open them with a code editor.

## License

[MIT](LICENSE).
