# Shared instruction builder (ADR 0023, iteration one, first increment)

Claude Code and Codex now start with the same instructions, built once by `agentInstructions` in `app/src/prompt.ts`; the adapters only deliver them. Neutral tool names merged three Claude Code/Codex pairs in the catalog, and Codex now gets the effort note too. Typecheck clean, tests 115/115; not yet tried with real agents. Not committed.

[Details](DETAILS.md).
