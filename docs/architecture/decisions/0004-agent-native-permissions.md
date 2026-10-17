# ADR 0004 — Agents use their own tools and permissions; the workspace observes

Status: accepted (2026-10-17, chosen by the user); implemented for sessions in [ADR 0005](0005-session-turn-runner.md), not yet for tasks. Supersedes the "file access only through the broker" and "no user settings" parts of [ADR 0001](0001-core-slice-stack.md); its task runtime, adapters-as-products and delegation decisions still hold. Specified in [sessions](../../features/sessions/SPEC.md) and [version-control](../../features/version-control/SPEC.md).

## Context

ADR 0001 starts each agent CLI with its own tools, settings and hooks disabled and routes all file access through the workspace broker (scope, write grant, audit, budget, effect ledger). The user rejects a separate workspace permission layer: permissions are already set in the agent's own settings (Claude Code, Codex) and in the version-control host's tokens (for example GitHub), and a third place means adjusting the same thing several times.

## Decision

- **Permissions live with the agent and the version-control host.** Agents run with their own built-in tools, user settings, rules, hooks and permission rules. The workspace adds no permission layer of its own and no write grant.
- **The agent always starts in the project folder** (working directory). The General space (sessions-014) has none.
- **Effective permissions are shown, not set:** at session start the workspace reads the agent's effective permission settings and shows a one-line summary; it warns visibly when the agent runs in a skip-all-permissions mode; writes outside the project folder seen in the event stream are flagged in the chat.
- **"Ask" keeps working headless:** the agent's permission prompts are relayed into the chat as approval cards (Allow / Deny), for example via Claude Code's `--permission-prompt-tool` and Codex's approval policy, so an "ask" rule does not silently become "deny".
- **Observation instead of mediation:** every agent event (text, tool call, command, edited file, approval, done, error) is normalized into one event contract and stored in the workspace audit log; the live activity display is built from it.
- **Recovery without an effect ledger:** before each turn the workspace records the project's version-control state (for Git: current commit and changed files, no extra commits). After an interruption it shows the changes since the turn started, and the continuation gives the agent the interruption marker plus that change list so it checks state instead of repeating steps. Projects without version control get the file list from events.
- **Stop and budgets:** Stop ends the turn's agent process; usage keeps being counted from the stream. No token cap by default (sessions-022/023).
- **The broker remains for workspace-owned tools only**, for example `delegate` (child tasks) and future workspace actions, with their scope and audit.

## Consequences

- One place per permission; the workspace behaves like each agent does elsewhere, and different agents may behave differently (the event contract keeps the display consistent).
- The workspace can no longer guarantee project-folder scope or repeat-free recovery by itself; it detects and reports instead. Shell commands are audited as commands, not per-file effects.
- Each new agent or version-control system needs adapter work per capability; tracked in the [integration matrix](../../INTEGRATIONS.md).

## Rejected

- Workspace permission layer seeded from agent settings ("may only be stricter"): a third place to maintain.
- Keeping the broker for all file access: requires duplicating each agent's permission model.
