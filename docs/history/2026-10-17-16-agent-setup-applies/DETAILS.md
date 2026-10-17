# 2026-10-17 — The agent's own setup applies in sessions

**Scope:** [sessions-025](../../features/sessions/SPEC.md#projects-agents-and-context) (new, agreed with the user), building on [ADR 0004](../../architecture/decisions/0004-agent-native-permissions.md) and the host-env fix ([2026-10-17-15](../2026-10-17-15-host-env-for-sessions/SUMMARY.md)).

**Outcome:** the `init` event's `plugins` (built-in ones left out), `mcp_servers` (name, status; the workspace's own approval server left out) and `skills` count are stored on the `init` session event and shown under the permission line, with MCP servers that are not connected flagged. Files: `app/src/adapters/claude-code.ts`, `app/src/sessions.ts`, `app/src/ui.html`; test in `app/test/sessions.test.ts`.

**Checks:** `npm test` 29/29, `npx tsc` clean. Real Claude Code 2.1.301 session with nothing configured in the workspace reported the user's 4 plugins, 6 connected MCP servers and 61 skills.

**Limits:** Codex `exec` loads the user's setup but does not report it ([#14](https://github.com/MomSesImSpcl/ai-workspace/issues/14)); tasks still start agents without user settings (ADR 0001, to move to ADR 0004); "applies from the next turn" follows from one process per turn and was not separately tested with a newly installed plugin.
