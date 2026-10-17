# Details: JSON and YAML in the code index

- Source: user-supplied JSON/YAML addendum with proposed IDs code-index-020–029. Kept 020–028 (027 and 028 trimmed to what 006/007 do not already say); proposed 029 (no execution, broker-run validators, fallback) is covered by code-index-009 and 010, so ID 029 stays unused.
- Order of the priority list set by the user: TypeScript first, then HTML, then the rest by current use.
- Repository acceptance targets checked to exist: `app/tsconfig.json` (`compilerOptions.strict`), `app/package.json` (`scripts.typecheck`), `app/package-lock.json`, `.github/workflows/ci.yml` (`jobs.test.strategy.matrix.os`).
- Candidates added to the technology table. Also fixed missing separators in the earlier priority sentence. No application code changed.
