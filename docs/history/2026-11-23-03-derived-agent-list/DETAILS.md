# 2026-11-23: agent list derived from the registered adapters

**Scope:** remaining part of [agent-interface-001](../../features/agent-interface/SPEC.md#requirements). Effort: medium.

**Outcome:** `app/src/instructions.ts`: `CATALOG_AGENTS = Object.keys(sessionAgents)`, and the "every agent" list used by all workspace-authored entries is that list. Outside sources that one agent loads itself (its rule files, own prompt, memories) stay labelled by agent. The Settings tab already takes its agent list from the API.

**Checks:** `npm run typecheck` clean; `npm test` 118/118 on Windows; new test in `app/test/instructions.test.ts`.

**Left as is:** the default role assignments in `app/src/roles.ts` and the UI's fallback to `claude-code` when a role has no assignment are configuration defaults, not lists of agents.

**Branch:** `agent-instructions` (this worktree), committed locally, not pushed.
