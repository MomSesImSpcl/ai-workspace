# ADR 0008 — One long-lived Claude Code process per session

Status: accepted (2026-10-17, requested by the user). Supersedes the "one agent process per turn" part of [ADR 0005](0005-session-turn-runner.md) for Claude Code; its event log, approval server and Codex-on-`exec` decisions still hold. Resolves [#15](https://github.com/MomSesImSpcl/ai-workspace/issues/15).

## Context

With a new `claude -p` process per turn, plugins and hooks lost their in-memory state between turns. The user's cache-tax plugin drops a prompt sent to a cold cache and lets the resend through; the resend ran in a new process, so every message was dropped and the session could not continue. The [sessions spec](../../features/sessions/SPEC.md#open-decisions) had left "a process kept open per session" open for this case.

## Decision

- **Session host:** the detached runner (`ws turn <id>`) for a Claude Code session is a host that keeps one `claude -p --input-format stream-json --output-format stream-json` process and writes each new user message to its stdin. Plugins, hooks and MCP servers therefore live for the whole session, as in an interactive Claude Code.
- **One host per session:** the host holds `<id>.pid`, created exclusively; a second runner exits at once. `<id>.starting` covers the moment between spawning and taking the lock. "Working" means a runner exists and the last turn has no end event.
- **Idle end:** the host ends its agent process and exits after 30 minutes without a message (`AI_WORKSPACE_SESSION_IDLE_MS`); the next message starts a new host that resumes the agent's conversation (`--resume`), or the workspace history when that is gone.
- **Stop:** Claude Code's own interrupt (`control_request` `interrupt` on stdin) ends the turn and keeps the process; if no result follows within 10 s, the process tree is ended.
- **Crash:** a turn that a dead host started but did not end is recorded as interrupted by the next host, never run again.
- **Approvals:** one approval server per agent process; it takes the current turn from the event log.
- Codex stays one process per turn until it moves to `codex app-server` ([#14](https://github.com/MomSesImSpcl/ai-workspace/issues/14)).

## Consequences

- No startup delay after the first message, and plugin or hook state survives between turns.
- An idle session holds a Claude Code process for up to 30 minutes.
- After the idle end, process-lived plugin state starts over, as when a user restarts Claude Code.
