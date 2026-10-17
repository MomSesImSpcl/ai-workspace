# ADR 0005 — Sessions slice 1: one detached agent process per turn, Codex on `exec`

Status: accepted (2026-10-17, chosen by the user). Implements part of [ADR 0004](0004-agent-native-permissions.md) for sessions; resolves the two open decisions in the [sessions spec](../../features/sessions/SPEC.md#open-decisions) for now.

## Context

The sessions spec left two choices open: whether a turn runs in its own agent process or a process kept per session, and whether Codex should move to the experimental `codex app-server` protocol now.

## Decision

- **One agent process per turn,** started by a detached `ws turn <sessionId>` runner (like task runners), so closing the window lets the reply finish (sessions-011). Stop is a marker file the runner watches; it ends the agent's whole process tree (`taskkill /T` on Windows).
- **History is an append-only event log per session** (`<workspace home>/sessions/<id>.jsonl`), the event contract of sessions-020; every event is also written to the workspace audit log. The chat display, the interruption marker and the text sent to agents that cannot resume are all folded from it. Vendor session ids are kept only as hints; an unknown Claude Code session restarts from the workspace history.
- **Claude Code** runs with its own tools, settings and rules, `--include-partial-messages` for streamed text, and `--permission-prompt-tool` pointing at a workspace MCP server (`app/src/approval-server.ts`) that turns each "ask" into an approval card.
- **Codex stays on `codex exec`** with the user's own config and sign-in: replies, activity from completed items, and Stop work; approvals and streaming do not ([#14](https://github.com/MomSesImSpcl/ai-workspace/issues/14)).
- **Agent and model come from the role** chosen when the session starts (Settings), so a model the CLI cannot resolve outside another app can be overridden per role.

## Consequences

- A few seconds of agent startup per turn; revisit a kept-open process if it proves annoying.
- Codex sessions deny what their policy would ask until the app-server protocol is adopted.
- Tasks keep ADR 0001's broker-mediated adapters until they move to ADR 0004 as well.
