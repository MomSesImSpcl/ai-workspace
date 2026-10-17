# 2026-10-18 — Tokens counted at real cost

- `used()` in `app/src/sessions.ts` weights cache reads 0.1 and writes 1.25 (Anthropic list prices); the task cap, `taskUsed`, CLI and UI (task list, project list, chat turn) use it. Spec task-runtime 4.6 (factual costs); ADR 0009 consequence updated.
- Checks: typecheck clean, `npm test` 38/38 (new weighting test); API on the scratch store: a one-call Claude Code task shows 31,494 instead of 93,920.
- Limit: one weighting for every provider and model (Codex/OpenAI has no write premium); the real cost depends on the plan.
- Not reduced: the size of the fixed prompt itself; measuring its split is a separate step.
- Branch `claude/tasks-feature-b7694b`.
