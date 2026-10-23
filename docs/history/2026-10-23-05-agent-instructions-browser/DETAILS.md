# 2026-10-23: agent instructions browser, iteration one

**Scope:** [agent-instructions-001–005](../../features/agent-instructions/SPEC.md#requirements) (new feature, user), [ADR 0022](../../architecture/decisions/0022-agent-instructions-catalog.md). Iteration one only: read only, development only; no editing and no change to what agents receive. Resumed after a task (`eba9b020`) researched the sources and drafted the catalog, then stopped when its quota ran out before any check.

**Outcome:**
- `app/src/instructions.ts`: the catalog (45 entries: role notes, messages and continuation, the 10 workspace tools, tool replies and refusals), the outside sources (12, read on this computer) and the development gate. Review fixes: the binding refusal now shows its kept-work and branch-gone parts as separate forms instead of joining texts the code writes apart; the merge refusal also names `GUARD_MARK` as its source.
- `app/src/adapters/codex.ts`: `userCodexHome` exported for the catalog.
- `app/src/ui.ts`: `GET /api/instructions` (refused outside a checkout) and `instructions` in the meta data.
- `app/src/ui.html`: the **Agent instructions** tab: search, role and agent filters, grouped list sorted A–Z with outside sources last, detail with text, other forms, parameters, placeholders, roles, conditions, channel and source; outside sources labelled by what can be inspected, files shown in their folder. Tab and selection are remembered.

**Checks:** `npm run typecheck` clean; `npm test` 114/114 on Windows, including the new `app/test/instructions.test.ts` (copies against their source files, every workspace tool and parameter description, placeholders explained, outside sources without provider text, the gate). Browser check against a UI server on throwaway storage, run from this worktree: the tab shows, 57 list items in five groups, Orchestrator + Codex filter and the search narrow the list, an entry and an outside source show their details, the selection survives a reload.

**Not verified:** the tab in the desktop app itself; a release build without a checkout (only the gate function is tested).

**Branch:** `agent-instructions`, uncommitted as the task left it.
