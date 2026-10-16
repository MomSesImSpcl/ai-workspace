# ADR 0002 — Task Center slice 1: local web UI over the core

Status: accepted (2026-10-16, stack and scope chosen by the user). Branch: `claude/ui-feature-suggestions-a7df7e`.

## Context

The [desktop client](../../features/desktop-client/SPEC.md) needs a Task Center whose tasks survive closing the client. The core (ADR 0001) runs a task in-process from the CLI, with no cancel and no way to see a task's runner.

## Decision

- **Stack:** `ws ui [--port 4317]` serves one static page (`app/src/ui.html`, vanilla JS) and a JSON API from `node:http` on `127.0.0.1`. No new dependencies or build step. A native shell (Electron/Tauri) waits until native integrations are needed.
- **Runners:** the UI starts each task as a detached `ws resume <id>` process logging to `tasks/<id>.log`, so closing the page or the server never stops a task. A runner records its pid in `tasks/<id>.pid`; the UI uses it to refuse a second runner and to show a crashed runner as resumable.
- **Cancel:** new terminal status `cancelled`. `cancelTask` writes `tasks/<id>.cancel`; the broker denies every tool call of the task and its delegated children, and the runner finishes the task as `cancelled` at the next step boundary. A task with no live runner is cancelled at once. Also available as `ws cancel <id>`.
- **Security:** loopback only; the Host check blocks DNS rebinding, and POSTs need a same-origin `Origin` plus `application/json`, which blocks cross-site requests.
- **Progress:** steps, tokens against budget, status, audit events and runner log. No percentages (spec 2.1).

## Rejected

- Electron now: ~100 MB dependency and packaging before any native feature is needed.
- Tauri now: Rust toolchain and a second language.
- Killing the runner on cancel: a stale pid could kill an unrelated process.

## Known limits

[#11](https://github.com/MomSesImSpcl/ai-workspace/issues/11) cancel is cooperative; [#12](https://github.com/MomSesImSpcl/ai-workspace/issues/12) a reused pid looks like a live runner.
