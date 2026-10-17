# 2026-10-17 — Agent-native permissions

**Scope:** user decisions: no workspace permission layer (permissions already live in the agent settings and host tokens); rule precedence project over workspace over global; no token cap by default, usage always visible, one cost-estimate range (the agent estimate replaces the history-based one when enabled); streaming and stop via one event contract and one process per turn; Git, then Git LFS, then others on demand; GitHub repository browsing belongs to the version-control feature; track per-integration implementation effort.

**Agreed fixes for losing the broker (row by row):** project folder as working directory plus permission summary, skip-permissions warning and out-of-project write flag (sessions-018); "ask" relayed as approval cards (sessions-019); all agent events stored in the audit log (sessions-020); turn-start version-control state replaces the effect ledger for recovery (sessions-021); display standardized through the event contract.

**Outcome:** ADR 0004 (supersedes the broker-only and no-user-settings parts of ADR 0001) and its index row; sessions-009/014/016/017 revised, sessions-018–024 added, open decisions reduced to turn process and Codex continuation; vcs-011 revised, vcs-012 added; new `docs/INTEGRATIONS.md` linked from the dependency inventory, ADR 0004 and both specs; tool-broker summary notes the change; traceability index updated.

**Checks:** local links checked; no application change. The existing core still enforces ADR 0001 until implementation work changes the adapters.

**Commit:** see branch `claude/ui-feature-suggestions-a7df7e`.
