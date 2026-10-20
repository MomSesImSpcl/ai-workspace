# 2026-10-20: Check for updates instead of background checks

Scope: [selfdev-005](../../features/self-development/SPEC.md#requirements), [ADR 0018](../../architecture/decisions/0018-restart-and-fallback.md) (amended). User decisions (2026-10-20): no background checks, since the user develops alone; one button with the texts "Check for updates", "Update and restart" (no count), "Waiting for merge", "Merge failed" and "Up to date"; polling every 10 s for at most 10 minutes while a merge is pending; a pulsing border in every state but the default (a style-guide exception); "Must be on main to update" as the tooltip off `main`.

## Outcome

- `app/src/restart.ts`: `localState` (branch and changes in `app/`, no network), `blocker` (the reason the checkout cannot update, also used by `applyUpdate`), `checkForUpdate` (fetch, then `update`, `blocked`, `waiting` with the open pull requests that have auto-merge, `failed` once each awaited one closed, lost auto-merge or failed a check, or `up-to-date`); gh calls through `AI_WORKSPACE_GH` for tests.
- `app/src/ui.ts`: GET `/api/app-update` reads only local state; POST `/api/app-update/check` runs the check; the 5-minute background fetch and its cache are gone.
- `app/src/ui.html`: one fixed-width button with those states, in the accent color (`.btn.primary`, the `--accent*` tokens; follow-up 2026-10-20 at the user's request); "Checking…" and "Updating…" while working; "Can't update" when `main` has local commits; "Check failed" when the fetch fails. Off `main` or with changes in `app/`, it is marked disabled (`aria-disabled`, so its tooltip still shows) and rechecks when the pointer comes to it. The 30-second page refresh is gone. The pulse turns into a steady border with reduced motion.
- `docs/UI_STYLE.md` records the pulse as the one agreed animation exception.

## Checks

- `npm run typecheck` clean, `npm test` 83/83; `app/test/restart.test.ts` covers the check with a fake gh: no auto-merge, waiting, checks still running, merged but not fetched, merged and fetched, a failed check, a closed pull request, no gh; and the blocked reasons.
- Real Electron on Linux (Xvfb) with a local bare origin: default state, "Up to date" (pulsing, back after 4 s), "Update and restart" after a new commit on origin, "Must be on main to update" and "Uncommitted changes in app/" tooltips with the button inert, and Update and restart onto the new commit (startup check passed). "Waiting for merge" was covered by the unit test only, not with a real pull request.
