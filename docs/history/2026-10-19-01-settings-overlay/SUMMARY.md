# Settings overlay with tabs

The user and agent agreed the Settings layout (desktop-001, [desktop-client](../../features/desktop-client/SPEC.md#21-desktop-client)). Settings now opens as an overlay at the tool rail instead of a column that narrowed the chat. It covers everything right of the sessions column, which stays visible, up to 900 px wide; a light backdrop fills the rest and closes Settings on click, as does Esc. Content is split into three tabs: **General** (workspace folder, storage), **Agents** (role agents, orchestrator instructions) and **Agent setup**. The last open tab is restored, also after a restart. Permissions ([permissions-001](../../features/agent-permissions/SPEC.md)) becomes a fourth tab when built.

Tests 49/49; checked in the browser against the UI server. Not yet tested by the user in the Electron app. See [details](DETAILS.md).
