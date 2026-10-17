# Agent setup onboarding and readiness in the UI

[Shared principles](../../PRINCIPLES.md) and [related features](SUMMARY.md) apply.

## Problem

The user assigns any agent integration to any role ([routing-001](../model-routing/SPEC.md#role-and-agent-assignments)), so no agent CLI is a direct dependency ([dependency inventory](../../DEPENDENCIES.md#agent-integrations-optional-users-choice)). Today nothing in the UI says this. A new user sees role names (`Orchestration`, `Implementation`) without knowing what they do, cannot tell which agents are installed or logged in, and only learns about a missing or logged-out agent when a started task fails.

## Proposed solution (agreed direction, not yet designed in detail)

Explain agents at the three places where the user makes a choice, all fed by one readiness check. No separate help page is needed to understand the basics.

## Requirements

- **onboarding-001 — One readiness source:** The UI MUST get agent status from the prerequisite check ([distribution-001](../distribution/SPEC.md#requirements-for-a-selected-implementation)), exposed through the local API, and MUST NOT guess. Per integration it reports one of: `ready` (with tested/installed version), `not-installed`, `not-logged-in`, `untested-version` (usable, with a warning), or `no-adapter` (such as `manual-browser`). The check runs on app start and on demand ("Check again"); it never installs software or logs in.
- **onboarding-002 — First-start agent setup:** When no runnable integration is `ready`, the app MUST open an "Agents" setup step instead of an empty workspace. It shows one card per supported integration with its status and the exact next action: a copy-ready install command for `not-installed`, and a button that starts the vendor's own login flow for `not-logged-in`. The heading states the rule in one plain sentence, for example "You need at least one agent. Each one uses your own subscription." Continuing MUST be possible once one integration is `ready`. The user can reopen this step later from Settings.
- **onboarding-003 — Roles as plain jobs:** Settings MUST present each role as the job it does, with the technical role name secondary, for example "Plans and splits work (Orchestration)" and "Writes and changes code (Implementation)". Each role's agent picker shows every integration with its readiness; integrations that are not `ready` stay selectable but are marked with the reason and a link to fix it. A role assigned to a non-ready integration MUST show a visible warning in Settings.
- **onboarding-004 — Readiness before starting a task:** The new-task composer MUST show which agent will run the task ("Runs with Claude Code · Implementation"). If that integration is not `ready`, the composer MUST replace the start action with a fix action (for example "Set up Claude Code first") and MUST NOT create a task that is known to fail for this reason.
- **onboarding-006 — Agent detection and selection:** The readiness check MUST also detect which known agents are present on the computer: the agent CLIs the workspace has adapters for, looked up on `PATH` and in each vendor's documented default install locations per OS. Detected agents MUST appear first in every agent selection (first-start step, role pickers), labeled "Found on this computer" with their version; agents not found stay listed below with how to get them. Detection only reads: it MUST NOT run anything beyond a version or login-status command, MUST NOT scan the user's files or other folders, and MUST NOT send results anywhere. Agent products the workspace has no adapter for MAY be shown as "Found, not supported yet" so the user knows why they cannot be picked.
- **onboarding-007 — Agent-specific readiness:** Beyond installed and logged in, the check MUST report known per-agent setup gaps that break features, with the exact fix. First case: Codex on Windows whose `codex doctor` reports "sandbox backend disabled" is marked `needs-setup` ("Codex can't write files on this PC") with the config change from the [dependency inventory](../../DEPENDENCIES.md#agent-integrations-optional-users-choice). The check only runs read-only diagnostics; it never changes the agent's config.
- **onboarding-005 — Privacy:** Logins stay in the vendor's flow; the workspace never asks for, stores or displays subscription credentials or tokens. Status details MUST NOT expose account identifiers beyond what the vendor CLI shows the user anyway.

## Non-goals

Installing agent CLIs automatically, managing subscriptions or billing, recommending a specific vendor, and explaining model capabilities. Installers and packaging stay in [distribution](../distribution/SPEC.md).

## Open decisions

- Exact wording of role descriptions and the setup heading.
- How "start the vendor's login flow" works per CLI (open a terminal with the login command, or show the command to copy).
- Whether onboarding also asks for the first project, or leaves that to the existing empty state.

## Suggested increments

onboarding-001 with the onboarding-003 hints is the smallest useful slice; onboarding-002 and onboarding-004 build on the same check.

## Acceptance checks

- With no agent CLI on `PATH`, the app opens the Agents step; each card shows `not-installed` with an install command; Continue is disabled.
- After installing and logging in one CLI and pressing "Check again", that card shows `ready` and Continue works.
- Logging out of the agent assigned to `Implementation` shows a warning on that role in Settings, and the composer offers "Set up … first" instead of starting; no task file is created.
- An installed version different from the last tested one shows `untested-version` and still allows starting tasks.
- On Windows with Codex's sandbox not set up, Codex shows `needs-setup` with the config change; after the user applies it and presses "Check again", it shows `ready`.
- With Claude Code installed in its default location but not on `PATH`, and Codex not installed, the role picker lists Claude Code under "Found on this computer" (with version) above Codex; detection created no files and made no network calls.
