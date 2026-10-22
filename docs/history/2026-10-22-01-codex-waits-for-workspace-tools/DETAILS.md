# 2026-10-22: Codex waits for the workspace tools

Scope: [orchestrator-006](../../features/ai-orchestrator/SPEC.md) and sessions-002 (chats start tasks through `start_task`), for Codex sessions.

## Cause

- The user's new Codex orchestrator chat (Codex CLI 0.163.0) refused to start a task for four turns. Its Codex rollout shows that, 3 s after the thread started, the first turn's tool list held only built-ins (`apply_patch`, `clock__curr_time`, the MCP resource tools), with no `mcp__aiws__*` tool. The workspace's session log recorded `"mcp":[]` for that turn and `aiws` `connected` from turn 2 on.
- In turns 2 to 4 the tools were present, but the model repeated its first answer without checking again. In turn 5 it checked, found them and started the task.
- `open()` in `app/src/adapters/codex.ts` sent the first `turn/start` right after `thread/start`. Codex starts the MCP servers from the thread config in the background, and a turn only gets the tools of servers already connected. `aiws` (Node running `approval-server.ts`) takes a few seconds to start.
- 7 stored session logs, all Codex, show `aiws` still `starting` when a turn began.

## Outcome

- `app/src/adapters/codex.ts`: when the thread config includes `mcp_servers.aiws`, `open()` waits until Codex reports `aiws` as anything other than `starting` (from `mcpServer/startupStatus/updated`), until the process exits, or for at most 30 s. Codex's own start-up timeout ends a hung start with `failed`. The 30 s cap applies only if Codex never reports a status.
- `app/src/adapters/claude-code.ts`: the `init` event no longer leaves out `aiws`, so Claude Code logs show its status like Codex logs do.

## Claude Code check

- Real Claude Code 2.1.301, given an MCP server that answers only after 8 s and run with `-p` and with the adapter's `--input-format stream-json`: the `init` line reported the server as `connected`, `mcp__aiws__start_task` was in the tool list, and the model named it. Claude Code waits for MCP servers before the first query, so it does not have this race.

## Checks

- `npm run typecheck` clean, `npm test` 99/99. `app/test/fake-codex.mjs` now reports `aiws` as `starting` and then, after 300 ms, as `ready`. The Codex orchestrator test asserts that the first turn starts only after `ready`. The Claude stream test expects `aiws` in `mcp`.
- Not yet run in the app with a real Codex chat.
