# 2026-10-21: Codex tasks get the shell at start; a setup continue stays in its run

Scope: [orchestrator-005](../../features/ai-orchestrator/SPEC.md), found by the user: a Claude Code orchestrator started a Codex task without `feature:shell_tool`, the task asked for it, and the task view showed the continue as "Reuse 1".

## Outcome

- `app/src/setup.ts`: `feature:shell_tool` defaults to on for the implementation role; a state the user set in Agent setup wins. `app/src/adapters/codex.ts`: its description no longer says commands run without it.
- `app/src/sessions.ts`: `setupContinue` and `isSetupContinue` for the workspace's continue message; `app/src/turn.ts` sends it, `app/src/ui.ts` folds that turn into the run before it, as it does for Resume (not counted as a pause). Messages from the user or the orchestrator still start a new run.

## Checks

- `npm run typecheck` clean, `npm test` 91/91; new tests in `app/test/tasks.test.ts` for the default state and the message match.
