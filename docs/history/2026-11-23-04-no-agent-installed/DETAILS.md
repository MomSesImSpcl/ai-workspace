# 2026-11-23: the app runs without any agent installed

**Scope:** new [onboarding-014](../../features/onboarding/SPEC.md#requirements) (user: the app must ship without any agent; role defaults empty, no fallback hard-coded to one agent, Settings must show it). Built on branch `agent-instructions` at the user's request. Effort: medium.

**Outcome:**
- `app/src/sessions.ts`: `SessionAgent.installed()`; `app/src/setup.ts`: `onPath` (the program as given, or on `PATH`, with `.exe`/`.cmd` on Windows); both adapters implement it (`CLAUDE_BIN`/`CODEX_BIN` or their command name).
- `app/src/turn.ts`: `installedAgents()`; `agentChoice` refuses an empty agent with "No agent is set up …" (HTTP 400).
- `app/src/roles.ts`: no default agents; an unsaved role gets the first installed agent or `''`.
- `app/src/ui.ts`: `/api/agents` and `integrations` list installed agents only; a role can be set only to one of them.
- `app/src/ui.html`: no `claude-code` fallback in the composer or Settings; one notice and disabled role fields when none is installed.

**Checks:** `npm run typecheck` clean; `npm test` 119/119 on Windows, with a new test in `app/test/agents.test.ts` (no installed agent: empty roles, start refused; one installed: roles use it) and `installed` in the interface check. Browser check against a throwaway UI server with no agents on `PATH`: `/api/agents` is empty, roles are empty, the composer shows "No agent installed", Settings → Agents shows the notice once with disabled fields.

**Not built:** onboarding-006's vendor install locations, versions and "Found on this computer" labels; the first-start Agents step (onboarding-002). Detection runs per request, but the page loads agents at start, so the notice says to restart the app.

**Branch:** `agent-instructions` (this worktree), committed locally, not pushed.
