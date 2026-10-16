# 2026-10-16 — Move application into app/

- **Scope:** user request: keep only docs, agent/readme Markdown and Git files in the root.
- **Outcome:** `package.json`, `package-lock.json`, `tsconfig.json`, `src/`, `test/` moved to `app/` (git mv, history kept). README, ADR 0001, traceability and distribution spec updated; earlier history entries keep their original `src/` paths as past records.
- **Checks:** from `app/`: `npx tsc` clean, `npm test` 14/14, CLI prints usage.
- **Branch / commit:** `feature/core-slice` and `main`; commit ID from Git.
