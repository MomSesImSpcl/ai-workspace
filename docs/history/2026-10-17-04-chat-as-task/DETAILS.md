# 2026-10-17 — Chat as task

**Scope:** user request to put a chat on the left, top to bottom, with the agent's and the user's messages, while keeping tasks inspectable. Agreed design: a chat is a task (no streaming, no tool calls in the chat, no separate chat store). Free chat (interactive sessions) deferred as its own feature.

**Outcome:**
- `runtime.ts`: `Task.messages` (the goal opens it; agent text is appended per step), `Task.prompt` (a pending user reply, cleared when a step commits), `conversation()` for tasks recorded before messages, `replyTask()` (refuses cancelled tasks and live runners; sets the task back to pending).
- Adapters: Claude Code sends the reply on `--resume` of its session; Codex, which starts a fresh `codex exec` per step, receives the whole conversation.
- `ui.ts`: `POST /api/tasks/:id/reply` (validated text) starts a runner; task views include `messages`.
- `ui.html`: chat column replaces the project navigation; role, budget and write options show only for a new chat; send is disabled while the task's runner works; Overview/Tasks are toolbar tabs; the Tasks page no longer has its own composer.

**Checks:** `npm test` 18/18 (new: reply continues a completed task with the user's message as the next prompt, conversation order, cancelled tasks refuse replies); `npm run typecheck` clean. Real run against Claude Code in a temporary workspace via the browser UI: first message "Read a.txt and reply with only its content." → agent "hello"; reply "Now reply with that word in uppercase." → "HELLO" in the same session; New chat cleared the column; selecting the task in Tasks reopened its conversation. Not checked: Codex replies, the Electron window itself (same page), macOS/Linux.

**Commit:** see branch `claude/ui-feature-suggestions-a7df7e`.
