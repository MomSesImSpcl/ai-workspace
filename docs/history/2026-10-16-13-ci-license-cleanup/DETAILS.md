# 2026-10-16 — CI, MIT license and repository cleanup

- **Scope:** user-approved layout improvements.
- **Outcome:** `.github/workflows/ci.yml`: `npm ci`, `npm run typecheck`, `npm test` in `app/` on `ubuntu-latest`, `windows-latest`, `macos-latest` (Node 24), and a `private-data` job failing on absolute user paths or personal-provider emails in tracked files. `LICENSE` (MIT), `"license": "MIT"` in `app/package.json`, README license section and `npm link` note. `.gitignore` Python entries removed (add back when needed). `app/package-lock.json` regenerated: it still carried the pre-rename package name and lacked the `bin` entry. [Working agreement](../../WORKING_AGREEMENT.md) step 11: delete merged branches locally and remotely. `feature/core-slice` deleted after its merge into `main`.
- **Checks:** private-data pattern matches a sample Windows user path and finds nothing in the tracked files; first CI run 38956463657 passed: typecheck and 14/14 tests on ubuntu-latest, windows-latest and macos-latest, private-data scan clean. Real-agent e2e remains Windows-only.
- **Branch / commit:** pushed to `main`; commit ID from Git.
