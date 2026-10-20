# Details: main ruleset

- Ruleset "main: require Windows and macOS tests" (repository settings, default branch): required status checks `test (windows-latest)` and `test (macos-latest)` from GitHub Actions; branches need not be up to date. No bypass: GitHub cannot exempt file types from a ruleset's bypass in a user-owned repository, so docs changes go through pull requests too.
- Repository setting: auto-merge allowed.
- `.github/workflows/ci.yml`: a `changes` step compares the pull request's base (or the pushed range on `main`) with `HEAD`; when only `*.md` and `*.txt` files changed, the setup, typecheck and test steps are skipped and the job passes. `private-data` always runs. Unknown base (new branch): everything runs.
- `docs/WORKING_AGREEMENT.md`: changes reach `main` through pull requests (`gh pr merge --squash`, or a fast-forward to a checked commit), docs pull requests with `gh pr merge --auto --squash`; `docs/MILESTONES.md` M1 step 4 merges through a pull request.
- Verified: ruleset created and read back through the GitHub API; the docs-only skip is not yet observed in a run (first run after this reaches `main`).
