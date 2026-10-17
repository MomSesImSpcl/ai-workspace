# The agent's own setup applies in sessions (sessions-025)

New requirement from the user: whatever is installed for the chosen agent (plugins, skills, hooks, MCP servers, settings `env`) must apply in sessions without configuring it in the workspace, and the session must show what loaded. Claude Code sessions already load it natively; they now record and show the loaded plugins, MCP servers with connection state, and skill count from the `init` event. Branch `claude/chat-sessions-per-project-f82af3`.

[Details](DETAILS.md).
