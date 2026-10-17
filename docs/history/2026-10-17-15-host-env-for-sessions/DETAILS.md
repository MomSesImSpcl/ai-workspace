# 2026-10-17 — Sessions use the user's Claude settings env

**Scope:** user request that all global settings (here a local proxy and custom model in the user's Claude settings `env`, plus hooks and plugins) also work in workspace sessions ([ADR 0004](../../architecture/decisions/0004-agent-native-permissions.md), sessions-016 global layer).

**Cause:** `claude -p` with a clean environment resolved the custom model through the user's proxy and finished; the same call with the variables a Claude Code host sets (`CLAUDECODE`, `CLAUDE_CODE_*`, `ANTHROPIC_BASE_URL`) went to the provider directly and failed with an unknown model. Starting the app from its shortcut is not affected; starting it from a terminal inside a Claude Code session was.

**Change:** `agentEnv()` in `app/src/adapters/claude-code.ts` removes `CLAUDECODE`, `CLAUDE_*` and `ANTHROPIC_*` from the session agent's environment when `CLAUDECODE` is set; otherwise the environment is passed unchanged. Tasks are unchanged (they still load no user settings, ADR 0001).

**Checks:** `npm test` 29/29 (new `agentEnv` test); `npx tsc` clean; real two-turn Claude Code session started from inside a Claude Code host with no role model set: both turns done, approval card relayed.

**Limit:** a variable the user set on purpose with one of those prefixes is also dropped when the app runs inside a Claude Code host.

**Branch:** `claude/chat-sessions-per-project-f82af3`.
