# User-added agents and version control systems

**Status:** not-started

Lets users add an agent or a version control system the workspace does not support yet, with as little effort as possible and without changing workspace code: a guided, documented onboarding that describes the tool in a small manifest, checks it against the required capabilities, shows what works and what falls back, and asks for explicit trust before the workspace runs it.

[Full requirements](SPEC.md).

**Dependencies / related features:** [onboarding](../onboarding/SUMMARY.md), [sessions](../sessions/SUMMARY.md), [version-control](../version-control/SUMMARY.md), [model-routing](../model-routing/SUMMARY.md), [provisioning](../provisioning/SUMMARY.md); contract: [ADR 0006](../../architecture/decisions/0006-agent-capability-contract.md), [integration matrix](../../INTEGRATIONS.md).
