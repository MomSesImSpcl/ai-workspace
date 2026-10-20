# 2026-10-20: restart onto new code and fall back (selfdev-005/006)

Scope: [selfdev-005, selfdev-006](../../features/self-development/SPEC.md#requirements), [ADR 0018](../../architecture/decisions/0018-restart-and-fallback.md). User decisions (2026-10-20): the startup check tests only basic function, since features are tested on their branch before merging; the last working version is the last one that passed its startup check, kept as a copy in storage rather than checked out fresh; a storage backup only before a version with a storage migration (not built).

## Outcome

- `app/desktop/main.mjs`: the restart keeps the old instance (hidden) until the new one passes `startupCheck`; on a failure or after 90 s the old one shows the reason and offers the last working version (`offerFallback`). A failed cold start offers the same. After a pass, `ws last-good <commit>` runs in the background (`last-good.log` next to `startup.log`). A fallback instance shows its commit in the title and restarts onto the real checkout.
- `app/desktop/preload.cjs`, `app/src/ui.html`: the page reports `ready` after it read projects, tasks and sessions, or `failed` with the error; the toolbar shows "Update and restart" when `main` is ahead, and "Last working version (commit)" in a fallback.
- `app/src/restart.ts`: `recordLastGood` (two slots, `npm ci` plus Electron's `install.js`, switch only when complete), `updateStatus`, `applyUpdate` (fast-forward only, `npm install --no-save` for changed dependencies).
- `app/src/ui.ts`: `/api/app-update` (status cached, fetched at most every 5 minutes; POST updates). `app/src/cli.ts`: `ws last-good`.
- Limits: [#37](https://github.com/MomSesImSpcl/ai-workspace/issues/37).

## Checks

- `npm run typecheck` clean; `npm test` passes, including `app/test/restart.test.ts` (copy and slot switch, what is not recorded, a failed build keeps the copy, update and its refusals, offline fetch).
- Real Electron 44 on Linux under Xvfb, in a scratch clone with its own storage: start passed its check and recorded the copy (slot a); a broken commit (`/api/meta` throws) restarted via ⟳ failed its check, the old instance showed "This version of AI Workspace did not start" with the reason and the last working version; "Start the last working version" started the copy, whose app project was still the real checkout; a fix pushed to `main` made "Update and restart" appear, which fast-forwarded the checkout, restarted onto it, passed the check, ended the fallback and recorded the fix as the new copy (slot b, slot a removed). A cold start of the broken commit showed the same dialog itself. The 90 s timeout path was not run on Linux.
- Windows (a local Claude session, at commit `7cd981a`, in a throwaway clone with its own storage and data folder): every flow passed: cold start (check in about 1.5 s), the copy recorded with Electron's `install.js`, a broken restart with the dialog, the fallback from the copy's own `electron.exe` with the app project still on the real checkout, ⟳ back onto the checkout, and Update and restart (slot b recorded, slot a removed). The 90 s timeout fired at 90.0 s, showed the dialog, ended the hung instance and started the fallback. Not run on macOS.
- Two findings from that test, fixed on the same branch: the fallback launch and a fallback's restart dropped the app's command-line switches, so `--user-data-dir` was lost and the logs went to the default data folder (`switches` in `app/desktop/main.mjs` now passes them on); and Update and restart appeared one check late, up to 5 minutes after a start (the first `/api/app-update` after a start now waits for its fetch, which runs with `GIT_TERMINAL_PROMPT=0`). Rechecked with real Electron on Linux started with `--user-data-dir`: every log line of the broken restart, the fallback and the way back landed in that folder, none in the default one, and the button appeared within seconds of a start.

## Windows test

1. After the merge, start the app from the main checkout on `main`. `last-good.log` in the app's data folder (next to `startup.log`) should say `recorded <commit>` after a minute or two.
2. To see the fallback, break the checkout on purpose without committing: in `app/src/ui.ts`, add `throw new Error('test');` as the first line of the `/api/meta` handler (search for `kind === 'meta'`). Press ⟳. The window disappears, and a dialog says the version did not start, with the reason.
3. Choose "Start the last working version". The app opens with "Last working version (commit)" in the toolbar.
4. Undo the change (`git checkout -- app/src/ui.ts`) and press ⟳. The app restarts onto the checkout and the note is gone.
5. "Update and restart" appears on its own after the next merge into `main` (checked every 5 minutes).

Branch `claude/great-ride-93ynxs`; commit in the pull request.
