# User-added agents and version control systems

[Shared principles](../../PRINCIPLES.md) apply, in particular principle 7 (only approved infrastructure runs executables) and the [cross-platform contract](../../PRINCIPLES.md#cross-platform-contract). [Related features](SUMMARY.md).

## Problem

New agent CLIs and version control systems appear faster than the workspace can ship adapters for them. A user who relies on one should be able to add it themselves, quickly and safely, and see exactly what the workspace can and cannot do with it. Every capability is defined once ([ADR 0006](../../architecture/decisions/0006-agent-capability-contract.md), [integration matrix](../../INTEGRATIONS.md)), so adding a tool means describing how it fills those rows.

## Goal

Adding a tool is as easy as possible and fully documented: a guided flow in the app, a manifest instead of code where the tool allows it, automatic checks, and a clear result. Built-in integrations follow the same path, so the documentation is proven by use.

## Requirements

- **custom-001 — Manifest:** An agent or version control system MUST be describable by a manifest without changing workspace code: how to start it (command, arguments, working folder), how to send a message or command and how to stop it, how its output maps to the workspace event contract (sessions-020; for version control, the vcs-010 operations), where its models and effort levels come from ([onboarding-008](../onboarding/SPEC.md)), and which capability rows it fills natively or by the row's fallback. Tools that cannot be described this way MAY use a code adapter with the same interface.
- **custom-002 — Guided onboarding:** The app MUST offer **Add agent…** and **Add version control…**: detect the tool on the computer, prefill the manifest from its help output and known patterns, and let the user adjust it in a form, never requiring hand-written files.
- **custom-003 — Conformance check (write guard row added 2026-10-20, user):** Before a tool is set up for the workspace, the onboarding MUST run the capability checks ([ADR 0006](../../architecture/decisions/0006-agent-capability-contract.md)) against it, using safe test inputs in a scratch folder, and show each row as native, fallback or unsupported with the reason. A tool with unsupported required rows MAY be added with those features disabled and visibly marked.
- **custom-004 — Explicit trust:** The workspace MUST NOT run a user-added tool until the user confirms the exact executable path, its source or publisher where known, the arguments and environment it receives, and the folders it may run in. A changed executable or manifest MUST ask again. Removing a tool removes its manifest and nothing else.
- **custom-005 — Documented, step by step:** Each step of the onboarding MUST link to documentation that explains what is asked, why, and how to find the answer for an unknown tool, with worked examples (the built-in Claude Code, Codex and Git integrations described as manifests). The documentation is part of the feature and updated with it.
- **custom-006 — Shareable:** A manifest MAY be exported and imported (without credentials or machine paths), so one user's setup helps others.
- **custom-007 — Same rules as built-ins:** User-added tools use the agent's own permissions (ADR 0004), report through the same event contract, appear in the same pickers and catalogs, and are covered by the same audit.

## Preparation that applies now

- No integration-specific checks outside adapters: behavior differences are adapter capabilities (for example "keeps one process per session"), never `integration === '<name>'` in shared code.
- New capabilities are added as matrix rows with a fallback ([ADR 0006](../../architecture/decisions/0006-agent-capability-contract.md)), so a manifest has a fixed list to fill.

## Non-goals

A marketplace or hosting of manifests, running tools the user has not confirmed, automatic installation of new tools (that is [provisioning](../provisioning/SPEC.md)).

## Open decisions

- Manifest format (JSON or YAML) and how event mapping is expressed (field paths versus small scripts).
- Whether code adapters can be added by users, and how they are isolated.

## Acceptance checks

- A user adds a new agent CLI through **Add agent…** without editing files; the check shows its rows as native, fallback or unsupported; a session can use it.
- The workspace does not run the tool before the user confirms it; replacing its executable asks again.
- Git, described as a manifest, passes the same version control checks as the built-in Git support.
- Every onboarding step links to documentation with a worked example.
