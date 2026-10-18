# 2026-10-18 — Orchestrator slice 1 (orchestrator-004, orchestrator-006, runtime-006)

Scope agreed with the user: the orchestrator is a session with role-keyed tool blocking; extended `aiws` tools; a choice card with an override; a cap switch; Pause and Resume. Left for later: token cost weights (onboarding-009), the planner handoff (orchestrator-002), lean setup (orchestrator-005). The card and switch layouts are kept in small functions, so they can be reworked.

## Changes

- `app/src/sessions.ts`: `ORCHESTRATION`, `ORCHESTRATOR_TOOLS`, `ORCHESTRATOR_NOTE` (the routing rule: a correction goes to its task with `reply_task`, anything to be done becomes a task, a question is answered; it asks back only when it cannot name what to change and the outcome; it does not stop to suggest an effort level). `TaskSpec.tokenBudget` is optional; `reason` and `overridden` are added; `Session.taskCap` is the chat's cap. `repeatsFor` also flags calls of a paused attempt.
- `app/src/adapters/claude-code.ts`: an Orchestration session gets `--disallowedTools Bash,Edit,Write,MultiEdit,NotebookEdit` and its `aiws` tools without a card, plus the note. Chat sessions get the same `aiws` tools.
- `app/src/adapters/codex.ts`: an Orchestration session runs with sandbox `read-only` and approval policy `never`, plus the note.
- `app/src/approval-server.ts`: `start_task` takes optional agent, model, effort, reason and tokenBudget. New: `reply_task`, `task_status`, `list_agents`.
- `app/src/tasks.ts`: `createTask` checks the chosen agent, model and effort against the catalog (`agentChoice`, moved from `ui.ts` to `turn.ts`) and records them; tasks without a budget are uncapped, and a chat's cap applies when none is given; `replyFromSession`; `pauseTask`; `startPendingTasks` also starts replies.
- `app/src/turn.ts`: a task's Pause interrupts the turn (the agent keeps its conversation); cancel and the cap still end the process tree.
- `app/src/ui.ts`: routes `tasks/:id/pause` and `resume`, session action `cap`, `taskCap` on create; a config change on a task marks it as overridden.
- `app/src/ui.html`: role picker (Orchestrator default, Chat) for a new session; cap switch under the composer (`renderCap`); task card with the choice line (`taskChoiceHtml`) and Pause, Resume and Change (`taskControlsHtml`), also on the Tasks page; Change dialog; "no cap" in the token summary.
- `app/src/store.ts`: `writeJson` retries a rename that Windows refuses while another process reads the file. This was found in the real run: a task's second save failed with `EPERM`, so the task was left as a plain session.

## Checks

- `npm run typecheck` clean; `npm test` 45/45. New tests: orchestrator blocking with both agents and an unblocked task of the same agent; uncapped tasks, chat cap, chosen and invalid agent or effort; pause keeps the conversation and resume flags repeats; `reply_task` only for the chat's own tasks; API for cap, pause, resume and override.
- Real run, scratch store, Codex as orchestrator, Claude Code as implementation agent:
  - "Create hello2.txt containing hi" called `list_agents` and `start_task` with a reason. The task card showed the agent and reason, "no cap", and approval cards.
  - Pause stopped the task with "(paused)". Change to effort Low showed "changed by you". Resume continued, and after Allow the task created the file.
  - "Actually the file should say hello" became `reply_task`. "What does hello2.txt contain right now?" was answered directly with `task_status`.
- The first message got an effort suggestion from the user's global rule; the note now tells the orchestrator not to do that.
- Found: in that run Codex used the user's own `node_repl` MCP tool, which can run code. Filed as [#16](https://github.com/MomSesImSpcl/ai-workspace/issues/16).
- Not run: Claude Code as orchestrator with the real CLI (covered with the fake CLI's arguments only); Electron window.
