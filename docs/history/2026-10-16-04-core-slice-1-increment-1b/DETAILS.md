# 2026-10-16 — Core slice 1, increment 1b: real Claude Code end-to-end

- **Scope:** close the increment 1 blocker after the user re-logged in to `claude`.
- **Found / fixed:** (1) user settings selected model alias `caveman-auto[1m]`, rejected in print mode; (2) user `~/.claude/CLAUDE.md` rules made the agent reply with only an effort suggestion. Fix: adapter passes `--setting-sources ""`; roles gained an optional `model` → `--model` ([ADR 0001](../../architecture/decisions/0001-core-slice-stack.md)).
- **Checks:** `npx tsc` clean; `npm test` 7/7. Real run `node src/cli.ts run "Create hello.md ... read ../outside.txt" --project demo --write`: task `completed`, 8,731 tokens, provider-reported ≈$0.0406; `hello.md` created; audit shows `write_file hello.md allowed` and `read_file ../outside.txt denied: outside project`. Not run for real: budget pause and kill/resume (unit-tested with a fake adapter only); read-only denial (unit-tested).
- **Remaining:** increment 2 — Codex CLI adapter for Orchestration.
- **Branch / commit:** `feature/core-slice`; commit ID from Git.
