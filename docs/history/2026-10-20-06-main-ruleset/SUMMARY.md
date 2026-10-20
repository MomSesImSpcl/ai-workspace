# main takes changes only through checked pull requests

A GitHub ruleset on `main` requires `test (windows-latest)` and `test (macos-latest)`, so every change reaches `main` through a pull request; docs-only pull requests (`*.md`, `*.txt`) pass the checks without tests and merge with auto-merge (user's choice, 2026-10-20). Decision: [ADR 0016](../../architecture/decisions/0016-main-ruleset.md). Branch `claude/great-ride-93ynxs`. [Details](DETAILS.md).
