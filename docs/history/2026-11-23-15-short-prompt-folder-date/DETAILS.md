# Details

- `app/src/registry.ts`: new text, `platform` placeholder removed, textBecause updated.
- `app/src/setup.ts`: `minimalPrompt` no longer passes the platform.
- `app/test/tasks.test.ts`: expects the new text.
- Verified: `npm run typecheck`; `npm test` 128/128 after the test fix (`tasks.test.ts` 33/33 rerun).
