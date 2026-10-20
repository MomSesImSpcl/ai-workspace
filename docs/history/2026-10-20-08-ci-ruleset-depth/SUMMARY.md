# CI: all four checks required, shallow checkout

`main`'s ruleset now requires a pull request and all four checks: `test (ubuntu-latest)`, `test (windows-latest)`, `test (macos-latest)` and `private-data` ([ADR 0016](../../architecture/decisions/0016-main-ruleset.md)). CI checks out 2 commits instead of the full history; docs-only detection compares a pull request's merge commit with its first parent. [Details](DETAILS.md).
