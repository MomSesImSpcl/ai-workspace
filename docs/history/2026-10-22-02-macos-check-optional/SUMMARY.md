# macOS check runs but is no longer required

Merges waited up to 29 minutes for a free macOS runner on GitHub, while every test job ran in under 2 minutes. The `main` ruleset now requires only `test (ubuntu-latest)`, `test (windows-latest)` and `private-data`; `test (macos-latest)` still runs on every ready pull request. [ADR 0016](../../architecture/decisions/0016-main-ruleset.md) amended. [Details](DETAILS.md).
