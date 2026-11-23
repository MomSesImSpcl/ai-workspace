# 2026-11-23: one registry for every instruction

**Scope:** [agent-interface-007](../../features/agent-interface/SPEC.md#requirements) (user: every new instruction must go through one API, so no untracked instructions reach agents). Effort: high.

**Outcome:**
- `app/src/registry.ts` (new, imports nothing from the app): `REGISTRY` with each entry's text, variants, tool parameters, roles, condition, channel, placeholders and needed capability; `agentText(id, values, variant)` fills placeholders in one pass and throws on a missing value or variant; `toolParam`; `isAgentText` for code that recognises its own message; `GUARD_MARK`.
- Senders now use it: `sessions.ts` (role notes, own instructions, storage note, setup continue, marker, transcript, relay, check-before-repeating), `prompt.ts`, `setup.ts` (minimal prompt, request_setup refusals), `merge.ts` (merge note and every request_merge reply), `tasks.ts` (start_task, reply_task and request_setup replies, resume, based-on context), `binding.ts` (binding refusal, its reasons and next steps), `guard.ts` and `worktrees.ts` (write guard texts), both adapters (earlier conversation), `approval-server.ts` (every tool and parameter description, approve, read_repo, start_task, reply_task and rename_task replies). `WORKSPACE_RULES` is gone; `GUARD_MARK` moved to the registry.
- `app/src/instructions.ts`: the catalog is built from the registry; "copy" entries and their source lists are gone. "Sent from" lists each file and line that names the id. Outside sources are unchanged.
- `app/src/ui.html`: the entry view shows "Defined in app/src/registry.ts · <id>" and "Sent from".
- Text changes for agents: none; the same 39 entries as before (checked by comparing ids with the previous catalog), wording unchanged except the catalog's own descriptive fields, which no longer name an agent.

**Checks:** `npm run typecheck` clean; `npm test` 120/120 on Windows. `app/test/instructions.test.ts` now checks: every entry and variant is sent; no fixed part (24+ characters) of any registry text, variant or parameter description is written elsewhere in `app/src` outside comments; every `description:` and `.describe(` in the tool server comes from the registry; `agentText` fills, refuses missing values and variants, and does not fill values again. The existing tests (byte-identical instructions for every agent, binding, merge, guard, tasks) pass unchanged. Browser check of the tab on throwaway storage: an entry shows its registry id and send site.

**Not done:** agent-interface-008 (each entry says why it cannot be code). Types do not stop free text in every sink; the scan test covers copies of registered text, not brand-new unregistered strings written straight into a reply.

**Branch:** `agent-instructions` (this worktree), committed locally, not pushed.
