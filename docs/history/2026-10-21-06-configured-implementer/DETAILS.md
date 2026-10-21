# 2026-10-21: Respect the configured implementer

Scope: [orchestrator-001, 004, 005](../../features/ai-orchestrator/SPEC.md#independently-selectable-roles), clarifying ADRs [0012](../../architecture/decisions/0012-lean-agent-setup-per-run.md) and [0013](../../architecture/decisions/0013-three-roles.md). Branch: `merge-conflict-test`; commit pending when recorded. This fix is separate from completed `read_repo` work.

## Cause and change

`ORCHESTRATOR_NOTE` treated the Implementation assignment as a default the orchestrator could replace and required a built-in tool for every task. Claude Code's selectable built-ins are `tool:*` items. Codex exposes feature switches, including `feature:shell_tool`, which defaults to always on for implementation and therefore is absent from the decidable list. The task-creation check already applies only when the agent inventory lists selectable built-ins; the prompt overstated that restriction.

- [Orchestration instructions](../../../app/src/sessions.ts) require the currently configured Implementation agent and model, inherited by omitting overrides in `start_task`. Only explicit user overrides permit changes. Missing capabilities require `request_setup` on the same agent or a blocker; a richer setup list cannot justify substitution.
- [Setup metadata](../../../app/src/setup.ts) adds `setupStatus`: always-on ids and whether the built-in-tool requirement applies. [Workspace tools](../../../app/src/approval-server.ts) expose that information beside the existing decidable list and explain the override contract. No fabricated Codex `tool:*` ids or adapter switches were added.
- [Regression tests](../../../app/test/tasks.test.ts) exercise the MCP catalog and dispatch, Codex with only `prompt` selected, default-on shell, same-agent setup requests, unknown ids, user-disabled setup, role/model inheritance and explicit alternate-agent overrides. Instruction assertions cover the routing and blocker guidance.

The runtime override API, unknown-agent/model validation, user-off setup checks, orchestrator read-only restrictions, sandbox and write guards are preserved. This is a correction to orchestration guidance and setup metadata, not a new deterministic mechanism for proving that an override came from a user.

## Verification

- Focused `node --test --test-timeout=60000 --test-force-exit --test-name-pattern="list_agents distinguishes|orchestrator instructions|chosen setup items|orchestrator role cannot|chosen agent, model|Codex's shell" app/test/tasks.test.ts`: 6/6 pass.
- `npm.cmd run typecheck` in `app/`: pass.
- `npm.cmd test` in `app/`: 95/95 pass outside the sandbox. The first sandbox run passed 89/95; six unrelated repository-status/update tests failed because Git could not access its global ignore file. The approved rerun resolved all six without code changes.
- Staged diff whitespace check and the CI private-data scan: pass.
- Existing security tests pass, including user-off setup rejection and role-based tool restrictions. No dependency, account configuration or security-boundary changes.

Remaining: user review/merge approval and a real orchestrator run confirming the configured implementer receives the task. Automated tests use fake agent processes and cannot prove a model follows instructions in every conversation.

Delivery: recorded in its own local commit. The session branch already has the separate open `read_repo` pull request #61, so this task does not push or request its merge.
