# ADR 0009 — Tasks are background sessions; Codex on `codex app-server`

Status: accepted (2026-10-17, chosen by the user); implemented. Implements [ADR 0007](0007-tasks-agent-native.md) (task-runtime 4.7). Removes ADR 0001's task step loop, broker file tools, write grant and effect ledger. Supersedes [ADR 0005](0005-session-turn-runner.md)'s "Codex on `exec`" and extends [ADR 0008](0008-session-host-process.md)'s long-lived process to Codex. Resolves [#14](https://github.com/MomSesImSpcl/ai-workspace/issues/14).

## Context

Sessions already had everything ADR 0007 asks of tasks: the agent's own setup, a long-lived process, approval cards that wait, Stop and a durable event log. Building the same for the old task runtime (bounded steps through broker file tools) would have kept two runtimes.

## Decision

- **A task is a session with a task spec** (`Session.task`: token budget, parent, cancelled). It runs in the same detached session host, records the same event log and is listed apart from chat sessions. Its status is read from the log: running, waiting (an unanswered approval card), completed, failed, paused (stopped by the workspace: budget or a possible repeat), interrupted (runner died), cancelled.
- **Permission mode** (runtime-003): `Session.permissionMode`, chosen from the agent's catalog `modes` and passed as the agent's own setting (Claude Code `--permission-mode`; Codex approval policy and sandbox presets per thread). Unset keeps the agent's settings; modes that skip every check are marked and warned about in the form.
- **Budget and cancel** (runtime-005): the host compares committed task usage (with subtasks) plus the turn's streamed usage against the cap and ends the agent's process tree when it is reached; cancel does the same at once. Chat sessions keep the graceful interrupt.
- **Repeat detection** (runtime-004): every activity event carries a fingerprint (tool and input). After an interrupted turn, Claude Code tasks get a `PreToolUse` hook (`app/src/repeat-hook.ts`, passed with `--settings`) that turns a matching call into an "ask", so it arrives as an approval card labelled as a possible repeat. Codex has no pre-run check: a matching `item/started` ends the process and pauses the task naming the step (ADR 0006 fallback).
- **Workspace MCP server** (`app/src/approval-server.ts`, server name `aiws`): `approve` for Claude Code's permission prompts and, for top-level tasks, `delegate`. Claude Code silently drops an `--mcp-config` server named `workspace`, hence `aiws`. A subtask gets the parent's project, at most its remaining budget and its mode when the agent is the same; depth stays 1.
- **Codex** runs as one `codex app-server` process per session (JSON-RPC over stdio) with the user's own config: approvals arrive as requests and become cards, text and usage stream, Stop sends `turn/interrupt`, the thread is resumed by id.
- **Migration:** task files from core slice 1 are converted once into task sessions with the same id; the old file is kept as `<id>.migrated.json`.

## Consequences

- One runtime for chat and background work; tasks gain live activity, Stop, approval cards and the agent's plugins and hooks.
- The workspace no longer confines tasks to the project folder or prevents repeated writes; it shows, holds or stops (ADR 0007).
- The cap is enforced per model call: the call that crosses it still completes (overshoot of at most one call, [#1](https://github.com/MomSesImSpcl/ai-workspace/issues/1)). With a large agent setup, prompt-cache tokens count towards the cap.
- Codex repeat detection depends on Codex reporting the same command text both times (it wraps commands in the shell call on Windows).
