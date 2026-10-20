# Details: CI runs reviewed (2026-10-20)

Scope: the user's CI questions (runs per pull request, redundant runs, the post-merge run). Branch `claude/great-ride-93ynxs`.

## Findings

- #30 and #32 runs, by event: `opened` as draft (Ubuntu and private-data), `ready_for_review` on the same commit (all systems), one `synchronize` per later push, and `push` to `main` after the squash merge. Concurrency had nothing to cancel: the draft run had finished before the pull request was marked ready. The only repeated work is the Ubuntu test and private-data scan (about 30 s) on draft-then-ready.
- The `main` run is kept: the squash commit can differ from what the pull request tested when `main` moved meanwhile, and it is `main`'s own status. GitHub e-mails the pusher when it fails (the user receives these).
- The `main` run after #30 (run 304) failed on Windows: the PowerShell access-list test hit its 20 s limit (`spawnSync powershell ETIMEDOUT`; 14 s on earlier runs, under 1 s on the user's PC) and the Codex app-server test's 10 s wait ran out; the whole Windows test step took 41 s instead of about 25 s. Flaky timing on a slow runner, not an app bug; it went unnoticed for about an hour until #32's `main` run passed.

## Changes

- No workflow change: it behaves as designed, and avoiding the 30 s repeat would cost more complexity than it saves.
- `AGENTS.md` and the CI section of `WORKING_AGREEMENT.md`: agents open a pull request as ready when it is complete and checked locally; drafts only for work in progress.
- `runAclScript` takes a time limit (the app keeps 20 s); its Windows test uses 45 s and no longer calls PowerShell a second time. The Codex app-server test waits up to 30 s for the first card.

## Verification

- `npm run typecheck` is clean, and `npm test` passes 75/75 (Linux). Windows timing is shown only by CI runs over time.
