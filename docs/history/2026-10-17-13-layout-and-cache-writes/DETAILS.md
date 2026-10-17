# 2026-10-17 — Layout changes and cache-write split

**Scope:** user requests: drag to widen the chat; color scheme like the Claude app; "print test" showed thousands of work tokens.

**Cause of the token report:** `tokens()` in the Claude adapter counted `cache_creation_input_tokens` (writing the agent's fixed prompt into the prompt cache) inside input but outside "cached", so it appeared as work. Example from the user's own "print test" step 1: 3,723 input, 33 output, 1,497 cache read; work showed 2,259, of which about 2,200 were cache writes.

**Outcome:**
- `Usage.cacheWriteTokens` (Claude `cache_creation_input_tokens`, Codex `cache_write_input_tokens`), summed in `addUsage` and in delegated-child accounting; `cacheTokens()` in `runtime.ts`; CLI and UI show work = total − cache reads − cache writes, and "prompt cache" = reads + writes. Tasks recorded earlier keep their old split (no cache-write data was stored).
- `ui.html`: palette tokens (`--accent*` replace `--pink*`; warm gray backgrounds, clay accent `#d97757`, primary buttons `#c6613f` with white text, user messages on a raised gray); Electron window and titlebar overlay colors match. Resizer on the chat column's right edge: pointer drag and Left/Right keys, 280px to 70% of the window, stored in `localStorage`.

**Checks:** `npm test` 18/18 (usage tests extended for cache writes), `npm run typecheck` clean. Browser check with a temporary workspace: a task with 3,723 input / 33 output / 1,497 read / 2,200 write shows "59 work + 3,697 prompt cache"; dragging the edge widened the chat from 370 to 512 px and stored it; arrow keys resize too. Not checked in the Electron window itself.

**Commit:** see branch `claude/ui-feature-suggestions-a7df7e`.
