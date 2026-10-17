# Sessions slice 1

The desktop chat column now holds per-project chat sessions instead of one task per chat: durable history, live activity that collapses on success and keeps an interruption marker otherwise, Stop, and Claude Code running with its own permissions and approval cards ([ADR 0005](../../architecture/decisions/0005-session-turn-runner.md)). Codex sessions run on `codex exec` without approvals or streaming ([#14](https://github.com/MomSesImSpcl/ai-workspace/issues/14)). Tests 28/28; real Claude Code and Codex runs in the UI. Branch `claude/chat-sessions-per-project-f82af3`, not merged.

[Details](DETAILS.md).
