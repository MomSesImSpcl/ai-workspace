# 2026-11-23: one agent interface, iteration one specified

**Scope:** new feature [agent-interface](../../features/agent-interface/SPEC.md), overview, traceability, integration matrix row "Deliver the workspace instructions", progress.

**Decided (user):** instructions are agent-agnostic and defined per role; agents have nothing to do with them, so any agent with an adapter runs with the existing setup. The Settings tab shows roles; an agent appears only in a capability gap. Work stays on branch `agent-instructions` until the feature is done, then it is pushed.

**Found on the branch:** the interface (`SessionAgent`, `AgentProcess`), the builder (`agentInstructions`) and the capability report were already built. Left: the orchestrator note still names Claude Code's `tool:*` ids and Codex's `feature:shell_tool`; the catalog's agent list is hand-written (`CATALOG_AGENTS`); delivery is not a reported capability.

**Housekeeping:** the `agent-instructions` worktree in workspace storage held uncommitted edits from 2026-10-23 that removed instruction text main added later (configured implementer, `read_repo` note, `request_merge` part of the merge note, `basedOn`). The user chose not to carry them over; that worktree was not touched.

**Checks:** documentation only; local links resolve; private-data scan clean.
