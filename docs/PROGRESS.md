# Current development progress

Read this file at startup. Search [history](history/) folder summaries only for relevant past decisions/evidence; read matching entries and expand if needed. Completed work and detailed checks belong there, under the [progress/history contract](WORKING_AGREEMENT.md#progress-and-history). Requirements/status remain in owning specs and [traceability](REQUIREMENTS_TRACEABILITY.md).

## Active / blocked

**Core slice 1: complete, merged into `main`** ([ADR 0001](architecture/decisions/0001-core-slice-stack.md)): TypeScript CLI, restart-safe tasks with budget pause, Claude Code and Codex adapters behind roles (routing-001), delegation, effect ledger ([evidence](history/2026-10-16-08-core-slice-1-increment-4/SUMMARY.md)). Remaining: one model turn can overshoot the budget. No blockers.

**Desktop client ([desktop-client](features/desktop-client/SPEC.md#21-desktop-client)): Electron workspace app, merged into `main`** with user approval ([ADR 0003](architecture/decisions/0003-electron-workspace-shell.md), superseding the stack of [ADR 0002](architecture/decisions/0002-task-center-local-web-ui.md)). Overview and Tasks tabs, Projects and Settings drawers, native folder dialog; detached task runners with cancel; Start menu/Desktop shortcuts and single instance ([evidence](history/2026-10-17-03-desktop-launch/SUMMARY.md)); interim chat column where each chat is a task ([evidence](history/2026-10-17-04-chat-as-task/SUMMARY.md)), now replaced by sessions (below); resizable chat, Claude-style colors, cache writes counted as prompt cache ([evidence](history/2026-10-17-13-layout-and-cache-writes/SUMMARY.md)). Open: [#11](https://github.com/MomSesImSpcl/ai-workspace/issues/11), [#12](https://github.com/MomSesImSpcl/ai-workspace/issues/12), [#13](https://github.com/MomSesImSpcl/ai-workspace/issues/13); G3, macOS/Linux and taskbar pin not run.

**Sessions ([spec](features/sessions/SPEC.md)): slice 1 built on `claude/chat-sessions-per-project-f82af3`, not merged** ([ADR 0005](architecture/decisions/0005-session-turn-runner.md), [evidence](history/2026-10-17-14-sessions-slice-1/SUMMARY.md)). Per-project sessions with durable event-log history, list (search, archive, rename, delete), streamed reply and live activity (collapsed on success, marker on stop/interrupt/failure, marker passed to the agent), Stop, Claude Code with its own permissions plus permission summary and approval cards; Codex on `codex exec` ([#14](https://github.com/MomSesImSpcl/ai-workspace/issues/14)). Tests 28/28. Not built: sessions-002, 009 turn-start state (021), 011–017, 022–024; Electron window not opened in the check.

**Specified, not implemented:** agent capability contract ([ADR 0006](architecture/decisions/0006-agent-capability-contract.md)) and agent-native tasks with approvals, permission mode and repeat detection ([task-runtime 4.7](features/task-runtime/SPEC.md#47-agent-native-tasks), [ADR 0007](architecture/decisions/0007-tasks-agent-native.md)), [version control](features/version-control/SUMMARY.md) (vcs-001–012), workspace definition ([identity-projects 1.4](features/identity-projects/SPEC.md#14-workspace-and-local-projects)), [ADR 0004](architecture/decisions/0004-agent-native-permissions.md) for tasks (sessions use it), onboarding-007. Per-integration mechanisms, checked against the real CLIs, are in the [integration matrix](INTEGRATIONS.md).

## Agreed direction

Personal tool first; retain user/project identity in the core for later authorization. Build thin, tested end-to-end slices through identity/projects, task runtime, model routing and tool broker, with runners/desktop only as needed; choose each bounded scope and free-to-use technologies together. Existing solutions take precedence. Knowledge features retain one shared index (`knowledge-001`).

Planning/design, orchestration and implementation roles are independently selectable; local/hosted integrations require verification, and browser planning is optional ([role requirements](features/ai-orchestrator/SPEC.md#independently-selectable-roles)). [Planning/wiki/public roadmap](features/project-planning/SPEC.md) and [Hermes/Hindsight evaluation](features/hermes-hindsight/SPEC.md) are defined concepts, with no adoption or implementation authorized. Select their concrete use cases and acceptance/security checks when chosen. History retrieval/storage is likewise separately defined, without fixed priority.

## Proposed — not yet agreed

Using the workspace on its own repository after the core and the longer tentative feature order remain proposals; see the [preserved proposal record](history/2026-10-16-00-imported-progress-snapshot/DETAILS.md#proposed-not-yet-agreed). There is no fixed delivery sequence.

## Resume here

Each feature gets its own branch created from the current `main` and is merged only after the user approves; setup on a new machine follows the [setup order](DEPENDENCIES.md#setup-order-on-a-new-machine). Run the app with `npm run desktop` in `app/` (or `AI Workspace.cmd` / `AI Workspace.command`); tests with `npm test`.

Next action: user reviews the sessions slice in the desktop app (`npm run desktop`) and approves or rejects merging `claude/chat-sessions-per-project-f82af3` into `main`. Agent and optional model per session come from the role in Settings; with no model set, the agent uses the user's own settings (proxy, model, hooks), also when the app is started inside a Claude Code host ([evidence](history/2026-10-17-15-host-env-for-sessions/SUMMARY.md)). Candidate next sessions slice, to agree first: tasks started from a session (sessions-002) and turn-start Git state (sessions-021), or Codex on `codex app-server` (#14).

Open limits: [`known-limit` issues](https://github.com/MomSesImSpcl/ai-workspace/issues?q=label%3Aknown-limit). Cross-cutting choices remain in [open decisions](OPEN_DECISIONS.md).
