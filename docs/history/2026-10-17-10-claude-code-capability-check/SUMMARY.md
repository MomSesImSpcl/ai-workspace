# Claude Code capability check

Checked the integration matrix's Claude Code cells against Claude Code 2.1.301 on Windows with real `claude -p` runs. Approval relay via `--permission-prompt-tool` works; the stream carries tool events, a `rate_limit_event` with utilization and reset times, and an `init` event with permission mode and loaded rule files. Allow/ask/deny rules must be read from settings files. The user's global `CLAUDE.md` loads even with `--setting-sources project`. [Integration matrix](../../INTEGRATIONS.md) updated.

[Details](DETAILS.md).
