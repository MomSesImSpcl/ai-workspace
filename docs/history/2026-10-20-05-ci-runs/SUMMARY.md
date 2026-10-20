# Leaner CI runs

CI runs once per change (pull requests and pushes to `main`), cancels outdated pull-request runs, and tests drafts on Ubuntu only while ready pull requests and `main` run Ubuntu, Windows and macOS (user's choice, 2026-10-20). Agents run typecheck, tests and the private-data scan before each push. Branch `claude/great-ride-93ynxs`. [Details](DETAILS.md).
