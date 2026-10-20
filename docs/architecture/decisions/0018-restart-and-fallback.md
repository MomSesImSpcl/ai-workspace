# ADR 0018 — Restart onto new code through a handover with a basic startup check; fall back to a kept copy of the last working version

Status: accepted (2026-10-20, chosen by the user), implemented 2026-10-20 for selfdev-005/006. Builds on [ADR 0003](0003-electron-workspace-shell.md) (Electron shell), [ADR 0008](0008-session-host-process.md) (detached session hosts), [ADR 0014](0014-worktree-per-session.md) and [ADR 0017](0017-merge-through-workspace.md) (changes reach `main` through checked pull requests).

## Context

[selfdev-005/006](../../features/self-development/SPEC.md) require that the running app takes merged code by a restart, and that a new version that fails to start never leaves the user without a working workspace. Before this, ⟳ started the new instance and exited at once, so nothing was left to notice a failure, and a failed start only showed an error box.

## Decision

- **Handover:** a restart starts the new instance and keeps the old one alive, with its window hidden. The new instance ends the old one only after it passed its startup check. If the new one exits first or takes longer than 90 s, the old one ends it, shows why (from the new instance's lines in `startup.log`) and offers the last working version. A failed cold start (no restart) offers the same itself. Code: `restart` handler, `startupCheck` and `offerFallback` in `app/desktop/main.mjs`.
- **Basic startup check (user, 2026-10-20):** the UI server starts, and the page loads and reads projects, tasks and sessions within 60 s (`ready` and `failed` in `app/desktop/preload.cjs`, sent at the end of the page's start in `app/src/ui.html`). A page load error, a crash or the server ending fails it. No tests run at start: every change passed typecheck, tests and CI on its branch before it merged.
- **Last working version = the last version that passed its startup check (user, 2026-10-20),** not simply the previous `main` commit, which may never have started. After a pass on a clean `main`, the app records that commit in the background (`ws last-good <commit>`, `recordLastGood` in `app/src/restart.ts`): a detached git worktree in workspace storage (`<storage>/last-good/a` or `b`), with `npm ci` and Electron's own binary fetched (Electron 44 fetches it on first use, not at install). Two slots take turns, and `last-good.json` switches only once a copy is complete, so a failed build keeps the old copy. A fallback instance never records.
- **Kept copy, not a fresh checkout (user, 2026-10-20):** the copy is ready at once and needs no network at the moment something already broke. It costs one extra checkout with its `node_modules`, a few hundred MB, mostly Electron.
- **Fallback instance:** started with the copy's own Electron and `AI_WORKSPACE_FALLBACK` (its commit) and `AI_WORKSPACE_REPO` (the real checkout), so the app project, worktrees and the write guard still point at the real checkout. It shows "Last working version (commit)" in the toolbar and window title, and its restart goes back to the real checkout.
- **Update and restart (selfdev-005):** the UI server fetches `origin/main` at most every 5 minutes in the background (`updateStatus`, `/api/app-update`). When the checkout is behind, the toolbar shows "Update and restart". It fast-forwards the checkout and restarts; it refuses another branch, uncommitted changes or local commits, so the user's own work is never merged or lost. Changed dependencies are installed with `npm install --no-save`, which leaves the running Electron's files in place, unlike `npm ci` (`applyUpdate`).
- **Sessions and tasks:** their hosts are detached processes (ADR 0008, 0009) and keep running through the restart; the restarted window restores the open chat.

## Rejected alternatives

- Running the test suite at start: slow (10 s or more), and CI already ran it on the same code.
- A fresh checkout of the previous commit at fallback time: needs the network and a full `npm ci` exactly when something is broken.
- Updating with `npm ci`: it deletes `node_modules`, including the running Electron, which Windows refuses.

## Known limits

Tracked in [#37](https://github.com/MomSesImSpcl/ai-workspace/issues/37): no storage backup or migration rule yet (agreed: a backup only when a version includes a storage migration, decided when the first one comes); a desktop shell too broken to run cannot show the dialog; running session hosts keep the old code until they end; an Electron upgrade cannot be installed on Windows while the app runs.
