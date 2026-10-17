# Current development progress

Read this file at startup. Search [history](history/) folder summaries only for relevant past decisions/evidence; read matching entries and expand if needed. Completed work and detailed checks belong there, under the [progress/history contract](WORKING_AGREEMENT.md#progress-and-history). Requirements/status remain in owning specs and [traceability](REQUIREMENTS_TRACEABILITY.md).

## Active / blocked

**Core slice 1: complete, merged into `main`** from `feature/core-slice` with user approval ([ADR 0001](architecture/decisions/0001-core-slice-stack.md)). TypeScript CLI; Claude Code as first agent adapter; Codex CLI on the ChatGPT subscription as the later orchestrator; any agent assignable to any role via config (routing-001). Acceptance: task survives a process kill and resumes; out-of-project or ungranted write is denied and audited; token budget overrun pauses the task.

Increments 1–4 done and verified: unit tests 14/14; real e2e for Claude Code (Implementation), Codex CLI (Orchestration, dedicated `CODEX_HOME` login), and Codex delegating a subtask to Claude Code with inherited scope, budget ceiling and usage charged to the parent. Budget pause and kill/resume also verified against real Claude Code; now with mid-step budget stop and an effect ledger so a re-run step does not repeat committed writes ([evidence](history/2026-10-16-08-core-slice-1-increment-4/SUMMARY.md)); remaining: one model turn can overshoot. No blockers.

**Desktop client ([desktop-client](features/desktop-client/SPEC.md#21-desktop-client)): Electron workspace app, merged into `main`** with user approval ([ADR 0003](architecture/decisions/0003-electron-workspace-shell.md), superseding the stack of [ADR 0002](architecture/decisions/0002-task-center-local-web-ui.md)). Overview and Tasks tabs, Projects and Settings drawers, native folder dialog; detached task runners with cancel; Start menu/Desktop shortcuts and single instance ([evidence](history/2026-10-17-03-desktop-launch/SUMMARY.md)); interim chat column where each chat is a task ([evidence](history/2026-10-17-04-chat-as-task/SUMMARY.md)); resizable chat, Claude-style colors, cache writes counted as prompt cache ([evidence](history/2026-10-17-13-layout-and-cache-writes/SUMMARY.md)). Tests 18/18. Open: [#11](https://github.com/MomSesImSpcl/ai-workspace/issues/11), [#12](https://github.com/MomSesImSpcl/ai-workspace/issues/12), [#13](https://github.com/MomSesImSpcl/ai-workspace/issues/13); G3, macOS/Linux and taskbar pin not run.

**Specified, not implemented:** [sessions](features/sessions/SUMMARY.md) (sessions-001–024: sessions per project, live activity, close behavior, General space, rule layers, agent-native permissions with approval cards, usage and estimates), [version control](features/version-control/SUMMARY.md) (vcs-001–012), workspace definition ([identity-projects 1.4](features/identity-projects/SPEC.md#14-workspace-and-local-projects)), [ADR 0004](architecture/decisions/0004-agent-native-permissions.md) (agents use their own permissions; supersedes parts of ADR 0001), onboarding-007. Per-integration mechanisms, checked against the real CLIs, are in the [integration matrix](INTEGRATIONS.md).

## Agreed direction

Personal tool first; retain user/project identity in the core for later authorization. Build thin, tested end-to-end slices through identity/projects, task runtime, model routing and tool broker, with runners/desktop only as needed; choose each bounded scope and free-to-use technologies together. Existing solutions take precedence. Knowledge features retain one shared index (`knowledge-001`).

Planning/design, orchestration and implementation roles are independently selectable; local/hosted integrations require verification, and browser planning is optional ([role requirements](features/ai-orchestrator/SPEC.md#independently-selectable-roles)). [Planning/wiki/public roadmap](features/project-planning/SPEC.md) and [Hermes/Hindsight evaluation](features/hermes-hindsight/SPEC.md) are defined concepts, with no adoption or implementation authorized. Select their concrete use cases and acceptance/security checks when chosen. History retrieval/storage is likewise separately defined, without fixed priority.

## Proposed — not yet agreed

Using the workspace on its own repository after the core and the longer tentative feature order remain proposals; see the [preserved proposal record](history/2026-10-16-00-imported-progress-snapshot/DETAILS.md#proposed-not-yet-agreed). There is no fixed delivery sequence.

## Resume here

Each feature gets its own branch created from the current `main` and is merged only after the user approves; setup on a new machine follows the [setup order](DEPENDENCIES.md#setup-order-on-a-new-machine). Run the app with `npm run desktop` in `app/` (or `AI Workspace.cmd` / `AI Workspace.command`); tests with `npm test`.

Next action (agreed with the user): implement the [sessions feature](features/sessions/SPEC.md) in a new session, on its own feature branch. Start by agreeing a first slice with the user; suggested smallest end-to-end slice: per-project session list and durable session history (sessions-001–006), live streamed activity from the Claude Code event stream (sessions-007/008/020), Stop (sessions-010), and the switch to agent-native permissions for Claude Code with approval cards (sessions-018/019, ADR 0004), replacing the interim chat-as-task column while keeping old task conversations readable. Codex needs the experimental `codex app-server` protocol for approvals and streaming (see the [integration matrix](INTEGRATIONS.md)); deciding whether to use it now is an open decision in the sessions spec. Read ADR 0004, the sessions spec and the matrix first.

Open limits: [`known-limit` issues](https://github.com/MomSesImSpcl/ai-workspace/issues?q=label%3Aknown-limit). Cross-cutting choices remain in [open decisions](OPEN_DECISIONS.md).
