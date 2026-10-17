# 2026-10-18 — A chat starts tasks (sessions-002)

- `app/src/approval-server.ts`: a chat session (not a task) gets `start_task` (goal, tokenBudget, optional role and permissionMode); a top-level task keeps `delegate`. Both agents are told about it (Claude Code `--append-system-prompt`, Codex `developerInstructions`); Codex chat sessions now load the `aiws` server, without auto-approval, so Codex's own approval policy decides a start.
- `app/src/tasks.ts` `startFromSession`: creates the task in the chat's project with `task.sessionId`, records a `task` event in the chat's current turn, starts it. `startedIn` lists a chat's tasks.
- `app/src/ui.ts`: a session's view includes its tasks (status, current step, tokens, pending approvals of the task and its subtasks, result); the sidebar badge counts them. Routes `POST /api/tasks` (start form) and `resume` removed; `reply` stays and is used from the chat.
- `app/src/ui.html`: task card in the chat turn that started it (status, Details, approval cards, result, reply); Tasks page shows starting prompt, chat link, what it works on, steps, tokens, permissions, Cancel. A task started from the CLI has no chat, so its pending approvals still show on its details.
- Checks: typecheck clean; `npm test` 40/40 (new: chat starts a task, view and reply through the API; the MCP server lists `start_task` for a chat and `delegate` for a task). UI checked in the browser on a scratch store: card with approval, Allow answered the task's card, Details page, no console errors.
- Not checked: real Claude Code and Codex runs calling `start_task`; how Codex's approval policy treats the tool in each mode.
- Limits: raising a paused task's budget has no control any more (the chat agent can start a new task); the chat agent is not told when its task ends, the user sees it in the chat.
- Branch `claude/chat-starts-task-feature-15a45f`.
