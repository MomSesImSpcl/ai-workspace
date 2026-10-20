# ADR 0006 — Agent capability contract with fallbacks and a conformance check

Status: accepted (2026-10-17, chosen by the user); not implemented. Builds on [ADR 0004](0004-agent-native-permissions.md). Affects every agent integration and every feature that relies on agent behavior.

## Context

Features so far were specified against the event contract (sessions-020) but implemented per agent: Claude Code got approval cards and streaming, Codex `exec` did not ([#14](https://github.com/MomSesImSpcl/ai-workspace/issues/14)). The user wants every workspace feature to work with every agent set up for the workspace, now and when new agents are added, without per-agent surprises.

## Decision

- **Capabilities, not agents:** the [integration matrix](../../INTEGRATIONS.md) rows are the required agent capabilities. Each row names the contract (event or control), the native mechanism per agent, and a **fallback** that keeps the user in control when an agent has no native mechanism (for example: detect after the fact from the event stream, stop the agent process, pause and ask). Features name the rows they rely on; a feature that needs a new capability adds a row and work for every agent.
- **Set up for the workspace** means: every row is built natively or covered by its fallback, and every row left on its fallback or unsupported has a `known-limit` issue and a visible note in the session or task.
- **Conformance check per agent:** one shared test suite per capability runs against each adapter's event mapping with recorded real CLI output as fixtures, plus a checklist of real runs recorded in history. A new agent or a new CLI version is accepted when the suite passes and the checklist is done.
- **First capability added under this rule:** "check a tool call before it runs and ask the user" (repeat detection, [ADR 0007](0007-tasks-agent-native.md)): Claude Code `PreToolUse` hook answering "ask"; Codex via its hooks or `app-server` approval requests (verify); fallback: detect the repeat from events, stop the process, pause with the repeated step named.

- **Write guard (added 2026-10-20, user):** keeping writes out of the running app's checkout and storage ([ADR 0015](0015-write-guard.md)) is a required capability. Each agent needs its own mechanism: Claude Code a pre-call hook, Codex its OS sandbox plus declined approval requests. An agent with neither is not offered for the app project.

## Consequences

- Features cost more per agent up front; in exchange no feature is silently single-agent.
- Codex sessions and tasks depend on moving to `codex app-server` for most rows (#14).
- Recorded fixtures must be refreshed when an agent CLI changes its output.

## Rejected

- Building features per agent and documenting gaps afterwards: leads to Claude-only behavior that users only discover in use.
