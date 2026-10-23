# 2026-10-23: capabilities in the shared agent interface

**Scope:** iteration one of ADR 0023 (one agent interface; the ADR is on PR #77), increment "formal adapter interface". Effort: medium (user).

**Finding:** the shared interface already existed: `SessionAgent` (open, permissions, catalog, inventory) and `AgentProcess` (turn, close) in `app/src/sessions.ts`, implemented by both adapters; the shared instruction builder (`app/src/prompt.ts`) delivers instructions through it. What was missing was the capability report.

**Outcome:**
- `app/src/sessions.ts`: `Capabilities` (`approvalTool`, `refusalText`) and their descriptions (`CAPABILITIES`); `SessionAgent.capabilities` is required.
- `app/src/adapters/claude-code.ts`: both true (approve is its permission prompt tool; the guard is a hook whose reason it reads). `app/src/adapters/codex.ts`: both false (its own approval requests are relayed; a refused write is declined without text).
- `app/src/instructions.ts`: entries name what they need (`needs`) and are written for every agent; `withCapabilities` derives which agents get them from the adapters. The four hand-marked Claude Code entries (approval answered, the three write guard texts) now use it.
- `app/src/ui.ts` / `ui.html`: the tab gets the derived catalog and the capability descriptions; a gap says which capability is missing.

**Checks:** `npm run typecheck` clean; `npm test` 116/116 on Windows, with the new `app/test/agents.test.ts` (every agent implements the interface and reports every capability; an entry needing a capability goes only to agents that report it). Browser check against a throwaway server: the merge refusal shows "Not yet for: codex (Chat, Implementer) It needs an agent that gets the write guard's reason when a write is refused"; the effort note shows no gap. Test fakes report no capabilities.

**Not changed:** agent behavior. Closing the gaps (the workspace providing these itself) is the capability-parity iteration.

**Branch:** `agent-instructions`.
