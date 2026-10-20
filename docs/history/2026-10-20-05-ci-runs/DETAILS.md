# Details: leaner CI runs (2026-10-20)

Scope: the user's CI suggestions, agreed with one choice (drafts test on Ubuntu only). Branch `claude/great-ride-93ynxs`, PR [#23](https://github.com/MomSesImSpcl/ai-workspace/pull/23).

## Changes

- `.github/workflows/ci.yml`: triggers on `push` to `main` and `pull_request` to `main` (`opened`, `synchronize`, `reopened`, `ready_for_review`), so a PR branch's push no longer starts a second run. `concurrency` per PR (or ref) cancels outdated pull-request runs, never runs on `main`. The test matrix is Ubuntu for draft PRs and Ubuntu, Windows and macOS otherwise; job names are unchanged. The private-data scan is unchanged.
- `AGENTS.md`: before each push, typecheck, tests and the private-data scan; logical commits pushed when complete; draft until done.
- `docs/WORKING_AGREEMENT.md`: a CI section with the behavior and the required checks to set in branch protection.

## Why

Every PR push ran twice before; the repo is public, so minutes are free and the gain is time and noise. Windows and macOS caught three real bugs on 2026-10-20 that Ubuntu missed, so they stay required before a merge.

## Verification

- `actionlint` 1.7.7 reports no problems; the matrix expression gives Ubuntu for a draft PR and three systems for a ready PR and `main`.
- Real runs on PR #23: see the progress entry once observed. Branch protection is not visible from the agent's session; the user sets the required checks.
