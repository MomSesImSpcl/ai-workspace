# 2026-10-17 — Sessions open decisions settled

**Scope:** user decisions on the open questions of the sessions feature.

**Decided:** General space (sessions-014); switchable agent with transcript handover (sessions-015); three context layers chosen by the user: global agent rules on the computer, workspace rules for all projects, project rules (sessions-016); project defaults per session, with the user's stated direction of unlimited budget and writes allowed (sessions-017).

**Constraint kept:** loading global rules reverses the earlier "no user settings" stance only for the rules text; user settings, hooks, permission rules, MCP servers and model aliases stay disabled so they cannot bypass the broker ([ADR 0001](../../architecture/decisions/0001-core-slice-stack.md)). Writes stay limited to the project folder and audited.

**Still open:** what a workspace is (local or online), rule precedence (proposed: more specific wins), budget/permission fine-tuning, adapter streaming and stop support.

**Checks:** local links checked; no application change.

**Commit:** see branch `claude/ui-feature-suggestions-a7df7e`.
