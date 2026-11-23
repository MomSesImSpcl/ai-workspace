# 2026-11-23: start_task enforces what the orchestrator note used to ask

**Scope:** orchestrator batch of [agent-interface-008](../../features/agent-interface/SPEC.md#requirements) (user). Effort: high.

**Outcome:**
- `app/src/tasks.ts` (`startFromSession`): an agent or model other than the role's assignment needs `override: true`, else the `override` refusal names the role's agent and model; setup ids go through `checkRequest` (unknown or switched off are refused); a task based on an earlier one keeps only those of its items that the new task's agent lists (before, a different agent could inherit ids it does not have).
- `app/src/approval-server.ts`: start_task's `title` and `reason` are required; new `override` parameter.
- `app/src/registry.ts`: the orchestrator note drops the sentences on inheriting agent and model, switching agents, list_agents fields, built-in tools, invented ids, the reply field, rename_task and what tasks do with request_setup; it keeps routing (1)–(3), basedOn, goal sizing, tokenBudget and setup choice, and effort. start_task's description drops the defaults sentence; its agent and model parameters say another needs `override`. list_agents drops its advice. Three proposals removed.
- Not converted (stay text, user informed): accepting tokenBudget only with a chat cap (the user asks for a cap in words, which code cannot see) and suggesting basedOn (relatedness is judgment).

**Decided after a real test (user, same day):** a first version let the orchestrator pick another agent with `override: true`; in the test it did when asked. The user ruled that the orchestrator must not choose the agent, but may choose its model ([ADR 0026](../../architecture/decisions/0026-orchestrator-does-not-choose-implementer.md)). start_task lost `agent`, `role` and `override` and keeps `model` (checked against that agent's catalog); `startFromSession` always uses the Implementation role; list_agents returns only `implementer` (agent, model, default effort, models with efforts, modes), its `setup` and `setupStatus`. The real test also showed the orchestrator relating a README task to earlier merge-test tasks and the based-on context nesting earlier contexts (open).

**Checks:** `npm run typecheck` clean; `npm test` 125/125 on Windows. New test in `app/test/tasks.test.ts` (override refusal and acceptance, the role's own model allowed, invented setup id refused, the note no longer mentions what start_task enforces); tests that passed unlisted setup ids now give the agent an inventory; MCP start_task calls pass title and reason.

**Not verified:** a real orchestrator chat starting tasks with the shorter note.

**Branch:** `agent-instructions` (this worktree), committed locally, not pushed.
