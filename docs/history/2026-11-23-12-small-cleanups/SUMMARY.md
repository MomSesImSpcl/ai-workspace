# Small cleanups: agent-interface-008 complete

read_repo's actions and parameters are now described in its input schema, not in one long text. The orchestrator's note on where storage lives and how it is laid out is replaced by a `search_history` tool that finds earlier chats and tasks by text. The chat's start_task hint and the read_repo hint stay, each with its reason. Every registry entry now either says why it is text or has become code. Tests 126/126.

[Details](DETAILS.md).
