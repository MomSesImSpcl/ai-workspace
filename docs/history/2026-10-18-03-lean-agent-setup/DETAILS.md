# 2026-10-18 — Lean agent setup

- Why: the user's full setup sends about 90k tokens per model call (history 2026-10-18-02).
- Specs: ai-orchestrator orchestrator-005, onboarding onboarding-010, note on task-runtime runtime-001.
- Unverified mechanisms: `--bare`, `--strict-mcp-config` with claude.ai connectors, Codex `disabledPluginIds`; switching off the global CLAUDE.md.
- Branch `claude/tasks-feature-b7694b`.
- Measured (Claude Code 2.1.301, haiku, `claude -p "reply ok"`, user's setup): full 90,465 prompt tokens; `--disallowedTools mcp__claude_ai_Google_Sheets mcp__claude_ai_Google_Drive mcp__claude_ai_Google_Docs` 74,066 (single claude.ai connectors can be dropped per run; `init` still lists them); `--strict-mcp-config` 47,558 (drops every MCP server, connectors included). The remaining ~47k are the system prompt, built-in tools, skill list, rule files and hook context; not split further.
- User: claude.ai connectors can also be disconnected one by one in the account (affects every Claude use, not one run). The orchestrator decides from each item's short title and description.
