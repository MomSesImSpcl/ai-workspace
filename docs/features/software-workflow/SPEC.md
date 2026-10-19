# Architecture, implementation and review workflow

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 6.3 Recommended software-development workflow skill

For complex software features, provide a reusable **architecture → implementation → review** workflow that uses configurable roles rather than named models:

1. Local retrieval/indexing gathers current project architecture, relevant code, tests, installed dependencies and Technology Catalog candidates.
2. The orchestrator chat (in Plan Mode, [orchestrator-007](../ai-orchestrator/SPEC.md)) writes a concise, versioned feature specification covering goals, non-goals, APIs/data structures, dependencies, data ownership, networking/security/concurrency, failure modes, implementation steps, tests and acceptance criteria.
3. An `Implementation` worker makes focused code changes, runs compilation/tests, responds to compiler/runtime evidence and records diffs. Routine edit/build/fix loops should not require the most expensive architect model.
4. If the existing specification is factually wrong or conflicts with the project, stop that step and escalate with concrete evidence/options; do not force implementation to match an invalid plan.
5. An independent architecture/code review checks the spec, actual diff, tests, performance/security implications and integration risk; fixes flow back to the implementer.
6. Human acceptance/merge follows the task's applicable risk policy.

The role mapping can change from Fable/Opus or other models at any time. For small code changes, the system may use a lighter workflow without compulsory architecture ceremonies.
