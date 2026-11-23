# 2026-11-23: every instruction says why it is text

**Scope:** first step of [agent-interface-008](../../features/agent-interface/SPEC.md#requirements) (user: instructions only when needed; everything else through a fixed API). No behavior change. Effort: high.

**Outcome:** `app/src/registry.ts`: `textBecause` (required) and `toCode` (optional) per entry; descriptions rewritten as one plain sentence each. `app/src/instructions.ts` carries both; `app/src/ui.html` shows "Why it is text" and "Could become code".

**Proposals (toCode), to convert later:**
- Orchestrator note: keep routing, goal sizing, effort and asking back; start_task refuses another agent or model without an explicit override flag, accepts tokenBudget only with a chat cap, and suggests basedOn in its reply. list_agents' advice on keeping the configured agent goes with it.
- Merge note and request_merge: request_merge runs typecheck and tests itself; the checks parameter and the sentences on gh pr merge, the API and pushing go. The merge refusal shortens.
- request_setup: the workspace ends the task's turn after the call; "End your turn" goes from the tool and its reply.
- read_repo: action list into the input schema. start_task: the defaults sentence goes. Chat start-task note and read_repo note: drop if the tool descriptions alone work. Storage note: a history search tool.

**Kept as text:** content (history, markers, relays, based-on context), the user's own text, tool descriptions and results, and judgment (routing, checking before repeating, working around a refusal).

**Checks:** `npm run typecheck` clean; `npm test` 121/121 on Windows with the new reason test. The tab change was not browser-checked (same pattern as the view checked earlier today).

**Branch:** `agent-instructions` (this worktree), committed locally, not pushed.
