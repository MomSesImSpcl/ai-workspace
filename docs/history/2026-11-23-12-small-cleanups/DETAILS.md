# 2026-11-23: small cleanups, agent-interface-008 complete

**Scope:** last batch of [agent-interface-008](../../features/agent-interface/SPEC.md#requirements). Effort: medium.

**Outcome:**
- `app/src/registry.ts`, `app/src/approval-server.ts`: read_repo's description is one sentence; `action`, `ref`, `path`, `limit`, `number`, `state` and `logs` carry their own descriptions from the registry.
- `app/src/sessions.ts`: `searchHistory(query, projectId?)` returns matching user messages and agent replies (session, title, task or chat, turn, time, excerpt), newest first, 20 at most; `app/src/approval-server.ts` offers it to orchestrator chats as `search_history` (this project by default, `all` for every project). The `orchestrator.storage` note is removed; the orchestrator note names search_history. `ORCHESTRATOR_TOOLS` lists it. Shortcut: each search reads every history; index them when storage grows (large-storage).
- The chat start-task hint and the read_repo hint stay: no evidence they are unneeded, and #31 showed an agent not trying read_repo without the hint. Their proposals are replaced by that reason.

**Checks:** `npm run typecheck` clean; `npm test` 126/126 on Windows; new test in `app/test/tasks.test.ts` (search in a project, any case, both sides of a turn, another project, all projects, empty query); the orchestrator's tool list includes search_history.

**Not verified:** a real orchestrator answering a question about past work with search_history.

**Branch:** `agent-instructions` (this worktree), committed locally, not pushed.
