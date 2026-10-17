# 2026-10-17 — Workspace definition and version control feature

**Scope:** user decision on what a workspace is: an app holding arbitrary local projects; projects go online through version control (GitHub, Perforce or other); basic version-control tools in the UI so the user need not ask an agent.

**Outcome:**
- `identity-projects/SPEC.md` 1.4: one workspace per computer and user, never hosted or synced; projects local, optionally version-controlled; project rules and portable config in the project folder; sessions, tasks and audit in workspace storage, never in project folders.
- `sessions/SPEC.md`: sessions-003 and sessions-016 state where history and each rule layer are stored; the "what a workspace is" open decision is closed.
- New `version-control/` feature (vcs-001–011, acceptance checks, open decisions: second provider, large files, agent commits, remote discovery); registered in the overview and traceability index; identity-projects summary links it.

**Checks:** local links checked; no application change.

**Commit:** see branch `claude/ui-feature-suggestions-a7df7e`.
