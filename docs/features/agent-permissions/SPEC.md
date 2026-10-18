# Workspace permission settings for agents

[Shared principles](../../PRINCIPLES.md) apply. [Summary and dependencies](SUMMARY.md).

## Purpose

A task asks for approval for every write and command when it runs in the agent's default mode. A chat can pick a task mode (`acceptEdits` by default since 2026-10-18), but writes outside the project folder still ask, and the choice lives per chat. The user wants these permissions as workspace settings ("allow global write, allow project write").

## Requirements

- **permissions-001 — Settings:** Settings MUST offer these switches, each with a one-line explanation:
  - **Write in the project folder** (default on for tasks).
  - **Write anywhere** (default off; shows a warning).
  - **Run commands without asking** (default off; shows a warning).

  They apply to tasks, and separately to chat sessions. Exact labels and grouping are decided when built.
- **permissions-002 — Applied per run:** The workspace MUST apply the settings to each agent run it starts, through the agent's own per-run mechanism, and MUST NOT edit the user's agent configuration files. Examples:
  - Claude Code: `--permission-mode`, `--settings` with permission rules, `--add-dir`.
  - Codex: thread `sandbox` and `approvalPolicy`, `sandbox_workspace_write.writable_roots`.

  The [integration matrix](../../INTEGRATIONS.md) row "Permission mode per task (runtime-003)" gets the exact mapping per agent. An agent that cannot express a setting keeps asking for that action, and the setting shows that limit.
- **permissions-003 — Stricter wins:** A chat's task mode, a task's own mode and the orchestrator role's blocked tools ([orchestrator-006](../ai-orchestrator/SPEC.md#independently-selectable-roles)) MAY restrict further than the settings, never less. The orchestrator stays unable to write whatever the settings say.
- **permissions-004 — Visible:** The permission summary (sessions-018) and the task details MUST show which settings applied to the run.

## Acceptance

- With "Write in the project folder" on, a task creates and edits files in its project without approval cards. A write outside the folder still shows a card.
- With "Write anywhere" on, the same task writes to another folder without a card. Turning it off applies from the next run.
- The same checks pass with Claude Code and Codex, or the setting shows the agent's limit.
- The user's agent settings files are unchanged afterwards.

## Non-goals

- Per-folder allow lists beyond "project" and "anywhere".
- Network permissions.
- Editing the agent's own settings files.

## Open decisions

- Whether the per-chat task mode picker stays once the settings exist.
