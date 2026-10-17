# 2026-10-17 — Setup recording

**Scope:** user agreed to record all setup steps so a new machine can be set up quickly, and to document the Codex Windows sandbox fix rather than apply it now (today's Codex runs are read-only through the broker; the fix matters once ADR 0004 is implemented, and it changes the user's own Codex security settings).

**Outcome:** `docs/DEPENDENCIES.md`: setup order section; Codex row with the Windows sandbox step (untested); Electron row with the npm 11 download fallback; platform row for the shortcuts. `README.md`: link to the setup order. `docs/WORKING_AGREEMENT.md`: setup steps are recorded with their dependency in the same commit. `docs/features/onboarding/SPEC.md`: onboarding-007 and an acceptance check; traceability index updated.

**Checks:** local links checked; no application change.

**Commit:** see branch `claude/ui-feature-suggestions-a7df7e`.
