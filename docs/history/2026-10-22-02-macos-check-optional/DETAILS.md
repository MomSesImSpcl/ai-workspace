# 2026-10-22: macOS check optional

Decision: user, 2026-10-22.

## Evidence

Last 8 CI runs (wait for a runner / run time): Ubuntu 3–5 s / 4–24 s, Windows 3–8 s / 11–104 s, private-data 3–4 s / 3–12 s, macOS 4–1,737 s / 7–45 s. Only the macOS queue was slow. One run in those 8 failed on Windows and macOS but passed on Ubuntu, so Windows stays required.

## Outcome

- GitHub ruleset 25475291 on `main` (changed through the API): required checks `test (ubuntu-latest)`, `test (windows-latest)`, `private-data`; still strict (branch up to date with `main`), no bypass. Renamed to "main: require pull request and CI checks (macOS optional)".
- `.github/workflows/ci.yml`: unchanged jobs; comments name the required checks.
- [ADR 0016](../../architecture/decisions/0016-main-ruleset.md) amendment, ADR index row and [the CI section](../../WORKING_AGREEMENT.md#ci) updated.

## Limits

A macOS-only failure can merge; it then shows on the merged pull request and needs a follow-up fix.

## Rejected

Merge when the first test job passes: Ubuntu always finishes first, so Windows would not gate merges in practice.
