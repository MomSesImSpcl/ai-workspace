# Sessions use the user's Claude settings env

Corrects [sessions slice 1](../2026-10-17-14-sessions-slice-1/SUMMARY.md): the "model only the desktop app resolves" failure came from the Claude desktop host's own variables (`ANTHROPIC_BASE_URL`, `CLAUDE_CODE_*`) inherited by the agent, which overrode the user's settings `env` (a local model proxy). Sessions now drop them when started inside a Claude Code host, so a session behaves like the user's Claude Code elsewhere and no role model is needed.

[Details](DETAILS.md).
