# 2026-10-17 — Claude Code capability check

**Scope:** user request to check the matrix's open Claude Code cells the same way as Codex.

**Environment:** Claude Code 2.1.301, Windows 10, a temporary project folder with `.claude/settings.json` = `{"permissions":{"ask":["Write","Bash"]}}`, and a test MCP server whose `approve` tool logs each request and answers deny.

**Real runs** (`claude -p … --output-format stream-json --verbose --setting-sources project --strict-mcp-config --mcp-config <test server> --permission-prompt-tool mcp__wsapprove__approve`):
1. The agent answered with an effort suggestion from the user's global `CLAUDE.md` instead of doing the task: user rules load even with `--setting-sources project`. The stream contained a `rate_limit_event` (status `allowed`, `rateLimitType` `five_hour`, utilization and `resetsAt` for the five-hour and seven-day windows).
2. With a prompt that satisfied that rule: `assistant` `tool_use: Write` → the approval tool received `tool_name: "Write"` and the input (path, content) → deny → `user` `tool_result: "Denied by workspace test"` → the agent replied "DENIED"; `result.permission_denials` listed the Write call; no file was created.

**`init` event:** includes `permissionMode` (`default`), the enabled `tools`, `memory_paths` (loaded rule files), `mcp_servers`, `model`, `cwd` and `additional_directories`; it does not include allow/ask/deny rules. No CLI command prints the merged effective settings.

**Help text:** `--include-partial-messages` streams text deltas with `stream-json`; `--permission-prompts host|none` decides whether prompts go to the host or are denied automatically.

**Not observed:** the stream at an actually exceeded usage limit. Remaining `verify` in the matrix: Codex limit text in `exec` and Codex writes on Windows.

**Commit:** see branch `claude/ui-feature-suggestions-a7df7e`.
