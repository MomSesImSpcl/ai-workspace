# ADR 0016 — main takes changes only through checked pull requests

Status: accepted (2026-10-20, user).

## Context

CI runs Ubuntu only for draft pull requests and all three systems for ready ones and `main` ([leaner CI runs](../../history/2026-10-20-05-ci-runs/SUMMARY.md)). Without branch rules, GitHub let a merge through even when the Windows or macOS run failed, and docs went straight to `main` unchecked.

## Decision

- A GitHub ruleset on the default branch requires a pull request (no approvals) and the checks `test (ubuntu-latest)`, `test (windows-latest)`, `test (macos-latest)` and `private-data`. No bypass. (Ubuntu and `private-data` added 2026-10-20 by the user.)
- Changes reach `main` through pull requests: `gh pr merge --squash`, or a fast-forward to a commit that passed the checks. A local merge commit pushed to `main` is rejected.
- A change to only `*.md` and `*.txt` files passes the required checks without tests (`.github/workflows/ci.yml`), so docs pull requests merge with auto-merge (`gh pr merge --auto --squash`) within seconds.
- M1's merge step (agent merges after the user's approval) goes through a pull request.

## Amendment 2026-10-20: up-to-date branches, no `main` run

The user turned on "Require branches to be up to date before merging". A pull request merges only when it contains `main`'s latest commit and passed all four checks on that code, so the squash commit equals what was tested. CI therefore no longer runs on pushes to `main`; that run repeated the pull request's run and sent extra mails. `request_merge` merges `main` into the branch before it pushes ([ADR 0017](0017-merge-through-workspace.md)).

## Rejected alternatives

- Admin bypass for docs only: GitHub rulesets cannot limit a bypass to file types; a full bypass would also let code skip the checks.
- Direct pushes with a CI warning afterwards: flags unchecked code but cannot stop it.
