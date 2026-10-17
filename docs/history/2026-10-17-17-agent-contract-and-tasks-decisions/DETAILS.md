# 2026-10-17 — Agent capability contract and agent-native tasks (decisions)

**Decisions (user, in chat):** approvals in tasks wait until answered (no timeout); permission mode defaults to the agent's settings with a per-task override via the agent's own flag; repeat detection by tool-call fingerprint, held as an approval card, with an after-the-fact fallback for agents without a pre-run check; capability rows with fallbacks and a per-agent conformance check as the condition for an agent being set up for the workspace.

**Changed:** ADR 0006 and 0007 (new) and the ADR index; [task-runtime](../../features/task-runtime/SPEC.md) 4.7 runtime-001–005 and its acceptance evidence (a repeat is held for the user instead of "without repeating a completed side effect"); [integration matrix](../../INTEGRATIONS.md) rows for the pre-run check and per-task permission mode, and the binding "Adding an integration" rule; [feature-writing guide](../../ADDING_FEATURES.md) rule to name capability rows; task-runtime summary status; progress.

**Not done:** no code. Codex rows stay `verify` until checked against the real CLI.

**Branch:** `claude/chat-sessions-per-project-f82af3`.
