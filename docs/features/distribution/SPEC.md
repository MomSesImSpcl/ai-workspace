# Workspace installation, packaging and cross-platform setup

[Shared principles](../../PRINCIPLES.md) and [related features](SUMMARY.md) apply.

## Purpose and status

Let another person or machine install, configure and run the workspace without the original developer's context. Product behavior is **not-started**. The baseline is the README [Getting started](../../../README.md#getting-started-prototype-cli) section plus npm-pinned dependencies (`app/package.json`, `app/package-lock.json`) and the [dependency inventory](../../DEPENDENCIES.md), which records every prerequisite with its tested version and is the input for distribution-001/002; it MUST stay current with every change to requirements or setup steps until this feature replaces it.

## Ownership

This feature owns installing and setting up the workspace application itself: runtime prerequisites, external agent CLIs and their logins, configuration of the workspace home, upgrade and uninstall. It does not own installing software that projects or tasks request ([provisioning](../provisioning/SPEC.md)), runner registration ([runners](../runners/SPEC.md)) or adapter behavior ([model routing](../model-routing/SPEC.md)).

## Requirements for a selected implementation

- **distribution-001 — Prerequisite check:** A setup or `doctor` command MUST report each required and optional dependency (runtime version, agent CLIs, logins, writable workspace home) as present, missing or wrong version, with the exact fix. It MUST NOT install or log in silently; logins stay user actions in the vendor's own flow, and the workspace never handles subscription credentials.
- **distribution-002 — Reproducible install:** A clean machine following the documented path MUST reach a working state verified by a smoke task. Dependency versions MUST be pinned or range-checked; external agent CLI versions the adapters were tested with MUST be recorded, and untested versions MUST produce a warning.
- **distribution-003 — Platform support matrix:** Each supported OS MUST have a documented, actually tested install path. Untested platforms MUST be labeled untested, not implied supported. Platform differences (path separators, shell shims, home locations) stay behind adapters ([architecture 13.4](../../ARCHITECTURE.md#134-portability-and-maintainability)).
- **distribution-004 — Upgrade and uninstall:** Upgrades MUST preserve workspace state (tasks, audit, roles) or migrate it with a backup; uninstall MUST state what it removes and keep user data unless the user explicitly asks to delete it.
- **distribution-005 — Packaging (optional):** Install scripts, OS packages, containers or a desktop installer MAY be added only when a trigger below applies. Each MUST pass distribution-002 on its platforms. A container MUST NOT weaken the tool broker's file scope or expose subscription logins to images.

## Triggers to go beyond the README

Evaluate at the end of each feature set; adopt the smallest step that resolves the trigger:

| Trigger | Likely step |
|---|---|
| A second person or machine installs the workspace and hits an undocumented step | distribution-001 check command |
| Setup questions or errors recur, or the README setup exceeds about one screen | install script per tested OS |
| A second OS must be supported | distribution-003 matrix with CI on that OS |
| Remote or headless runners need identical environments | container image (with runners) |
| Non-developer users or a public release | packaged installer, possibly with the desktop client |

## Non-goals

Publishing to package registries, auto-update, or managed hosting, unless separately agreed.

## Acceptance evidence

- On a clean machine of each supported OS, follow only the documented steps and complete a smoke task; record the OS, versions and result.
- The check command reports a deliberately missing CLI and a wrong Node version with correct fixes, and installs nothing.
- An upgrade from the previous version keeps existing tasks and audit records readable.
