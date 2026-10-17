# Workspace installation, packaging and cross-platform setup

**Status:** not-started

Make the workspace itself installable and runnable on machines other than the developer's: dependency checks, guided setup of external agent CLIs and logins, install scripts or packages, optional containers, a tested per-OS support matrix, GitHub releases and an in-app update check that installs a new release when the user starts it. The current baseline is the README "Getting started" section with npm-pinned dependencies. This feature defines when to go beyond that, with explicit trigger criteria; no installer, container or package is selected or implemented. Installing tools *for projects* belongs to provisioning, not here.

[Full requirements and triggers](SPEC.md).

**Dependencies / related features:** [provisioning](../provisioning/SUMMARY.md), [runners](../runners/SUMMARY.md), [model-routing](../model-routing/SUMMARY.md), [desktop-client](../desktop-client/SUMMARY.md), [onboarding](../onboarding/SUMMARY.md) (shows the prerequisite check in the UI).
