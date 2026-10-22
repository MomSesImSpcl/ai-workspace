# Codex waits for the workspace tools before its first turn

A new Codex orchestrator chat said `start_task` was not available and kept saying so until the user insisted. Codex connects MCP servers in the background, and the first turn started before the workspace server (`aiws`) was ready, so that turn had none of its tools. The Codex adapter now waits for `aiws` to finish starting before the first turn. Claude Code was checked and already waits. Claude Code chats now record `aiws`'s status too. [Details](DETAILS.md).
