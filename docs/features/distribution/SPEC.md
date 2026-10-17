# Workspace installation, packaging and cross-platform setup

[Shared principles](../../PRINCIPLES.md) and [related features](SUMMARY.md) apply.

## Purpose and status

Let another person or machine install, configure and run the workspace without the original developer's context. Product behavior is **not-started**. The baseline is the README [Getting started](../../../README.md#getting-started-prototype-cli) section plus npm-pinned dependencies (`app/package.json`, `app/package-lock.json`) and the [dependency inventory](../../DEPENDENCIES.md), which records every prerequisite with its tested version and is the input for distribution-001/002; it MUST stay current with every change to requirements or setup steps until this feature replaces it.

## Ownership

This feature owns installing and setting up the workspace application itself: runtime prerequisites, external agent CLIs and their logins, configuration of the workspace home, upgrade and uninstall. It does not own installing software that projects or tasks request ([provisioning](../provisioning/SPEC.md)), runner registration ([runners](../runners/SPEC.md)) or adapter behavior ([model routing](../model-routing/SPEC.md)).

## Requirements for a selected implementation

- **distribution-001 — Prerequisite check:** A setup or `doctor` command MUST report each required and optional dependency (runtime version, agent CLIs, logins, writable workspace home) as present, missing or wrong version, with the exact fix. It MUST NOT install or log in silently; logins stay user actions in the vendor's own flow, and the workspace never handles subscription credentials. The desktop app presents its results through [onboarding](../onboarding/SPEC.md).
- **distribution-002 — Reproducible install:** A clean machine following the documented path MUST reach a working state verified by a smoke task. Dependency versions MUST be pinned or range-checked; external agent CLI versions the adapters were tested with MUST be recorded, and untested versions MUST produce a warning.
- **distribution-003 — Platform support matrix:** Each supported OS MUST have a documented, actually tested install path. Untested platforms MUST be labeled untested, not implied supported. Platform differences (path separators, shell shims, home locations) stay behind adapters ([architecture 13.4](../../ARCHITECTURE.md#134-portability-and-maintainability)).
- **distribution-004 — Upgrade and uninstall:** Upgrades MUST preserve workspace state (tasks, audit, roles) or migrate it with a backup; uninstall MUST state what it removes and keep user data unless the user explicitly asks to delete it.
- **distribution-005 — Packaging (optional):** Install scripts, OS packages, containers or a desktop installer MAY be added only when a trigger below applies. Each MUST pass distribution-002 on its platforms. A container MUST NOT weaken the tool broker's file scope or expose subscription logins to images.
- **distribution-006 — Releases:** A release is a GitHub Release on the project's repository with a semantic-version tag that matches the app version (`app/package.json` `version`), release notes and, when distribution-005 packages exist, their assets. The first release starts the update path below.
- **distribution-007 — Update check:** The desktop app MUST show its installed version and let the user check whether a newer release exists (on request, and MAY check at startup, which the user can turn off). The result shows the new version and its release notes, or that the app is current; an unreachable server or rate limit is reported, never shown as "up to date". The check sends no user data beyond what the request itself requires.
- **distribution-008 — Update from the workspace:** The user starts the update from the app; nothing installs without that click. The update gets the release by its tag (Git checkout plus `npm ci` in a source install, the release asset for a packaged install), verifies it (tag/commit or published checksum), keeps or migrates state under distribution-004 with a backup, and restarts onto the new version with sessions and tasks surviving and a fallback to the previous version if it fails to start ([self-development](../self-development/SPEC.md) selfdev-005, selfdev-006). Local changes in a source install block the update with an explanation instead of being overwritten. Pre-releases are offered only when the user opts in.

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

Publishing to package registries, silent or unattended auto-update, or managed hosting, unless separately agreed. Checking for and starting an update from the app is agreed (distribution-006–008, 2026-10-17).

## Acceptance evidence

- On a clean machine of each supported OS, follow only the documented steps and complete a smoke task; record the OS, versions and result.
- The check command reports a deliberately missing CLI and a wrong Node version with correct fixes, and installs nothing.
- An upgrade from the previous version keeps existing tasks and audit records readable.
- With a newer test release published, the app shows the new version and notes; starting the update installs it, keeps sessions and tasks and restarts onto it; offline, the check reports the failure; a source install with local changes refuses to update and says why.
