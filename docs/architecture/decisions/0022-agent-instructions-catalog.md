# ADR 0022: A static catalog of agent instructions

## Status

accepted 2026-10-23, implemented 2026-10-23 ([agent-instructions-001–005](../../features/agent-instructions/SPEC.md#requirements)).

## Context

The workspace's agent-facing texts are spread over the adapters, the workspace MCP server, tasks, merge and binding code. The user wants to read them all before deciding how editing should work, without changing what agents receive.

## Decision

- `app/src/instructions.ts` holds a static catalog with purpose, roles, agents, conditions, channel, source and placeholders per entry. Prompt assembly stays in the adapters.
- An entry shows the exported definition the agents get where one exists; text written inline in code is copied, and `app/test/instructions.test.ts` fails when a copy, a tool or a parameter description no longer matches its source.
- Outside sources are described, not read, except the Instructions fields the workspace holds; paths are shown with whether the file exists.
- The tab and its data are available only when the app runs from a git checkout.

## Rejected alternatives

- Tracing what one session received: needs runtime recording; deferred.
- Moving every inline text into exported constants now: a wide refactor of working code before editing is designed.

## Known limits

- The catalog lists what can be sent and when, not what a given run received.
- A new inline agent-facing text is caught by the tests only when it changes an existing entry or adds a workspace tool; others need adding by hand.
