# 2026-10-16 — Task Center slice 1 (desktop-client)

**Scope:** [desktop-client 2.1](../../features/desktop-client/SPEC.md#21-desktop-client): Task Center list, details, create, resume, cancel; the client does not own task state. Stack and scope chosen by the user: local web UI; list + detail + start/resume + cancel. Decision: [ADR 0002](../../architecture/decisions/0002-task-center-local-web-ui.md).

**Outcome:**
- `app/src/ui.ts`, `app/src/ui.html`: loopback server and page; 2 s polling; Host/Origin/JSON guards.
- `app/src/runtime.ts`: `cancelled` status, `cancelTask`, cancel marker (inherited by children), runner pid file, `listTasks`.
- `app/src/broker.ts`: denies tool calls of a cancelled task.
- `app/src/roles.ts`: `newRoleTask`, shared by CLI and UI.
- `app/src/cli.ts`: `ws cancel`, `ws ui`; `ws status` no longer reads `<id>.live.json` side files as tasks (bug fixed via `listTasks`).

**Checks (2026-10-16, Windows 10, Node 24):**
- `npx tsc` clean; `npm test` 17/17 (new: cancel idle/running/child, `listTasks`, UI API host/origin/content-type guards).
- Real Claude Code, temporary workspace home, read-only demo project: task started from the UI; UI server stopped mid-run; task completed (`steps=1`, 8,002 tokens) and showed as completed after restart.
- Real cancel: running task cancelled from the UI after 4 reads; the 5th `read_file` was denied ("task cancelled; stop now"); task ended `cancelled` at step end with usage charged (30,151 tokens).

**Not covered:** G3 (concurrent tasks with two models) not run; macOS/Linux not run; no native shell, notifications or project/conversation views.

**Open limits:** [#11](https://github.com/MomSesImSpcl/ai-workspace/issues/11), [#12](https://github.com/MomSesImSpcl/ai-workspace/issues/12).

**Commit:** see branch `claude/ui-feature-suggestions-a7df7e`.
