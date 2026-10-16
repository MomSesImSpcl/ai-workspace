# 2026-10-16 — Core slice 1, increment 2: Codex CLI adapter for Orchestration

- **Scope:** routing-001, 5.2 — make `Orchestration → codex` runnable through the same task/budget/broker/audit path. Delegation to Implementation is increment 3.
- **Outcome:** `src/adapters/codex.ts` registered in `src/roles.ts`; decisions in [ADR 0001](../../architecture/decisions/0001-core-slice-stack.md).
- **Found / fixed:** user `~/.codex/AGENTS.md` hijacked tasks → dedicated `CODEX_HOME` (user logged in once); disabling code mode hid MCP tools → code mode kept, read-only sandbox; MCP calls blocked by `approval_policy="never"` → `mcp_servers.ws.default_tools_approval_mode="approve"`; Windows `.cmd` shim → run `codex.js` with node.
- **Checks:** `npx tsc` clean; `npm test` 8/8 (adds Codex event parsing). Real run `--role Orchestration --write`: task `completed`, 37,535 tokens; `plan.md` written; audit `write_file plan.md allowed`, `read_file ../outside.txt denied: outside project`. Bypass attempt via `apply_patch`: model declined, no file created — sandbox block not directly exercised. Codex reports no cost; none shown.
- **Remaining:** increment 3 — orchestrator delegates subtasks to the Implementation role (child tasks, budget inheritance).
- **Branch / commit:** `feature/core-slice`; commit ID from Git.
