# ADR 0007 — Tasks run agent-native: approvals, permission mode, repeat detection

Status: accepted (2026-10-17, chosen by the user); implemented 2026-10-17 as background sessions ([ADR 0009](0009-tasks-are-sessions.md)). Applies [ADR 0004](0004-agent-native-permissions.md) to delegated tasks and supersedes, for tasks, ADR 0001's write grant, effect ledger and per-call budget check. Capability rules from [ADR 0006](0006-agent-capability-contract.md). Specified in [task-runtime 4.7](../../features/task-runtime/SPEC.md#47-agent-native-tasks).

## Decision

(Superseded 2026-10-23 by [ADR 0024](0024-no-delegate.md): `delegate` is removed; tasks do not start tasks.) - **Same start as sessions:** a task starts the agent with its own tools, settings, plugins, hooks and MCP servers (sessions-025); the workspace MCP server keeps only `delegate`. The "Allow writes" option is removed.
- **Approvals wait until answered:** an "ask" from the agent becomes an approval card in the task view; the task waits, with no timeout, and the waiting state is visible in the task list (and later in notifications).
- **Permission mode:** the task form defaults to the agent's own settings and offers a per-task override passed as the agent's own flag (Claude Code `--permission-mode`, typically `acceptEdits` for long background tasks). `bypassPermissions` is never a default and shows a warning.
- **Recovery:** before each step the turn-start version-control state is recorded (sessions-021). On resume the agent gets the interruption marker and the changes since the step started.
- **Repeat detection:** every tool call is recorded with a fingerprint (tool and input hash). While an interrupted step re-runs, a call matching one the interrupted attempt already completed is held and shown as an approval card ("Possible repeat: … already ran before the interruption"); the task waits for the user. Agents without a pre-run check use the fallback in ADR 0006.
- **Budget and cancel:** the cap is enforced from streamed usage by ending the agent's process tree and pausing the task; cancel ends the process tree at once.

## Consequences

- The workspace no longer guarantees project-folder scope or that no write repeats; it detects, holds or reports and lets the user decide. Only exact repeats are caught before they run.
- Once built, removes for Claude Code the limits of the per-call budget check and cooperative cancel ([#1](https://github.com/MomSesImSpcl/ai-workspace/issues/1), [#3](https://github.com/MomSesImSpcl/ai-workspace/issues/3), [#11](https://github.com/MomSesImSpcl/ai-workspace/issues/11)).
