# 2026-10-23: smaller iterations

**Scope:** [working agreement](../../WORKING_AGREEMENT.md) point 3 (vertical slices, small increments).

**Why (user):** the agent instructions work showed problems only after a large scope was built. Smaller iterations are tried sooner, and a smaller scope often needs a lower effort level, which saves tokens; a higher level stays allowed when an increment truly needs it.

**Change:** point 3 adds both reasons and asks plans to list increments with a suggested effort level per increment, never the level of the hardest part for all.

**Checks:** documentation only; private-data scan clean.

**Branch:** `claude/smaller-iterations`.
