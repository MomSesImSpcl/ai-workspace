# 2026-11-23: instruction editing specified, entry view simplified

**Decided (user):** the tab becomes the home of every default instruction and ships in released builds. Each text form has Default, Override or Append. An override replaces the default entirely and may say anything ("shit in, shit out"); Append adds the user's text. User text may use only the entry's placeholders. The Settings → Agents Instructions fields become per-role "Your instructions" entries. "Used by", "When included", "How it reaches the agent" and "Source" are dropped from the entry view; when an entry is sent becomes part of its description. Order: entry view now, then agent-interface-008, then editing.

**Description from code:** the description is one field of the registry entry, the only place the instruction is defined, rather than taken from method comments: one text is sent from several functions, some inline, so comments would not describe it reliably.

**Outcome:** `app/src/registry.ts`: `purpose` and `when` merged into `description` ("<purpose>. Sent: <when>"), `channel` removed. `app/src/instructions.ts`: catalog entries carry `description`; send sites stay internal for the tests. `app/src/ui.html`: the entry view shows title, description, id and a one-line agent gap where one exists.

**Specified, not built:** agent-instructions-006, 008–011; ADR 0025 (amends ADR 0022).

**Checks:** `npm run typecheck` clean; `npm test` 120/120 on Windows (instruction texts and tests unchanged). Browser check on throwaway storage: the write guard entry shows its description, id and "Not yet for codex …" line, and none of the removed fields.

**Branch:** `agent-instructions` (this worktree), committed locally, not pushed.
