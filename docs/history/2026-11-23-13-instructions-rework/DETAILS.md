# 2026-11-23: instructions reworked by role and by tool

**Why (user):** 39 entries looked like far more communication than the user expected (one note and one start message per task). The tab should show all fixed agent-to-agent text, compactly, with no way for unregistered text to reach an agent. Built on a separate branch so the user can compare before choosing.

**Outcome (`app/src/registry.ts`):**
- Role notes: `note.chat`, `note.orchestrator`, `note.task`, each with sections `own` (the user's instructions), `merge` (app-project worktrees) and `rules` (workspace AGENTS.md) where they apply; `minimal-prompt`. `composeText` joins the note and its sections with blank lines (`app/src/prompt.ts`).
- Messages: `message.task-start` (goal, or goal with the earlier task's context), `message.history` (earlier conversation and the form of each turn), `message.turn` (unfinished-turn marker, check before repeating, relay), `message.continue` (resume, after request_setup).
- Tools: each `tool.*` keeps description and parameters and now holds its replies as variants (for example `tool.start_task`: ok, noTool, fromTask; `tool.request_merge`: 15 forms, including the former merged-pr reply).
- Refusals: `refusal.binding`, `refusal.guard` (file, command, instead, merge), `refusal.failed` ("The workspace could not do this: {error}").
- Types: `agentText`, `composeText` and `toolParam` return `AgentText`; `asData` labels data; `AgentError` carries registry text. `app/src/approval-server.ts` builds every result through `answer(text: AgentText | AgentData)`; `failure(e)` passes an `AgentError` as is and frames any other error with `refusal.failed`. `requestMerge`, `requestSetup`, `bindingProblem` and `agentInstructions` return `AgentText`.
- Removed: the note constants (`TASK_NOTE`, `READ_REPO_NOTE`, `ORCHESTRATOR_NOTE`, `MERGE_NOTE`, `orchestratorNote`); `ownInstructions` returns the user's text only.

**What changes for agents:** the notes' wording is unchanged but laid out as paragraphs; the effort line reads "AI Workspace: effort level …" for every role; validation errors from workspace tools now arrive as "The workspace could not do this: …".

**Checks:** `npm run typecheck` clean; `npm test` 127/127 on Windows; new test: the tool server has one result builder typed for registry text or data. The catalog API lists 21 entries in four groups, none unsent. Not browser-checked; not tried with real agents.

**Branch:** `claude/instructions-rework`, from `claude/agent-instructions-e69c98` at eaca15a; committed locally, not pushed.
