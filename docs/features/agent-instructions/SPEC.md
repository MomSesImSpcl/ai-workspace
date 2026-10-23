# Agent instructions browser

[Summary](SUMMARY.md). Decision: [ADR 0022](../../architecture/decisions/0022-agent-instructions-catalog.md).

The user wants to find every rule the workspace gives agents, read it, and understand where and why it is used, before deciding how editing should work (user, 2026-10-23). Iteration one is read only.

## Requirements

- **agent-instructions-001 — Development only (built 2026-10-23):** The **Agent instructions** tab in Settings and its data are available only while the app runs from a git checkout, the condition Update and restart also needs. Elsewhere the tab is not shown and the data request is refused. Whether a release shows it is not decided.
- **agent-instructions-002 — Complete catalog (built 2026-10-23):** The tab lists every agent-facing text the workspace writes: role notes in the system or developer prompt, text it puts into messages (earlier conversation, unfinished-turn markers, continuations, context from an earlier task), the descriptions and parameter descriptions of its workspace tools, and tool replies and refusals that tell the agent what to do next. Plain validation errors that only name a bad value are left out. Entries are grouped by purpose: role notes, messages and continuation, workspace tools, tool replies and refusals.
- **agent-instructions-003 — Find (built 2026-10-23):** A search field filters by title, purpose, text and id; a filter narrows to one role (Chat, Orchestrator, Implementer, Subtask). Entries name roles, not agents: every agent gets the same instructions ([ADR 0023](../../architecture/decisions/0023-one-agent-interface.md)); where an agent still misses an entry, the entry shows that gap until the unified interface removes it. Each list entry shows its name and a short purpose; groups are sorted A–Z.
- **agent-instructions-004 — Read (built 2026-10-23):** The selected entry shows its purpose, its full text with formatting kept, other forms of the same message with when each is used, tool parameters, the roles that get it, any agent still missing it, when it is included, how it reaches the agent, and its source file and definition. Placeholders such as `{branch}` are marked and explained as values filled in when the text is sent, never as actual values. The text MUST match what the code sends: an entry shows the exported definition the agents get, or a copy that an automated test compares with its source, the tool list and the parameter descriptions of the workspace server.
- **agent-instructions-005 — Outside sources (built 2026-10-23):** Sources the workspace does not write are listed separately: the Instructions fields of Settings → Agents (shown in full), the workspace folder's and the user's global rule files (path and whether the file exists, opened in its folder), project rule files, the agents' own system prompts, Codex memories and other agent extensions. Each is labelled with what can be inspected; text the workspace cannot read is marked as such, and the tab MUST NOT suggest it contains provider instructions it does not have.

## Non-goals and open decisions

- Iteration one has no editing, overrides, precedence changes or changes to what agents receive.
- Deferred: a preview of the exact instructions one session received, which needs runtime tracing.
- Open: how editing should work, and whether a release build shows the tab.

## Acceptance evidence

- `app/test/instructions.test.ts`: copies match their sources, every workspace tool and parameter description is listed, every placeholder is explained, outside sources carry no provider text, the development gate.
- Browser check of the tab against a UI server on throwaway storage ([history](../../history/2026-10-23-05-agent-instructions-browser/SUMMARY.md)).
