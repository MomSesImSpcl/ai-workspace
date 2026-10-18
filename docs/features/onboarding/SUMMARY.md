# Agent setup onboarding and readiness in the UI

**Status:** in-progress: agent setup inventory with per-run switches built (onboarding-010); agent readiness and setup steps not built

Make it obvious in the desktop app which agents exist, which are ready to use, and what each role needs. Any agent can run any role, so no agent CLI is required up front, but at least one must be installed and logged in. The app detects agents already installed on the computer and offers them first. A first-start setup step, plain-language role settings and a readiness check in the task composer explain this where the user decides, without failed tasks. Status comes from the distribution prerequisite check.

[Full requirements](SPEC.md).

**Dependencies / related features:** [desktop-client](../desktop-client/SUMMARY.md), [distribution](../distribution/SUMMARY.md), [model-routing](../model-routing/SUMMARY.md).
