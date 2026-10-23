# 2026-10-23: test instance of a branch

**Scope:** [selfdev-009](../../features/self-development/SPEC.md#requirements) (new, user request), [ADR 0020](../../architecture/decisions/0020-test-instance.md); uiverify-001 now points at it, the rest of [ui-verification](../../features/ui-verification/SPEC.md) stays unbuilt (user).

**Outcome:** `app/src/test-instance.ts` (when a worktree counts as installed, the start plan, the start with copied settings); `/api/test-instance` and a per-session `testable` flag in `app/src/ui.ts`; the branch heading's context menu, the title and the hidden Check for updates in `app/src/ui.html`; the window title and no last working version in `app/desktop/main.mjs`; `testHome` and its removal with the worktree in `app/src/worktrees.ts`.

**Checks:** `npm run typecheck` clean; `npm test` 108/108 on Windows (new `app/test/test-instance.test.ts`; `app/test/worktrees.test.ts` checks the storage goes with the branch). Smoke test on Windows: a test instance of this worktree started with the main checkout's Electron while the user's app was open; its startup check passed, its window was titled `Test Branch - smoke-test`, and a second launch logged "lock held by another instance, quitting". Not tried: the menu item in the running app, and the hidden button and titlebar text in the page (only the window title was seen).

**Branch:** `claude/test-instance`.
