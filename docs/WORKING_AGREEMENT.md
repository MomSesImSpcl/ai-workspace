# Implementation working agreement

Maintain progress, requirement traceability and ADRs whenever implementation or significant decisions change. Start each session by checking current progress, relevant requirement rows and decisions using the selective reading process below.

## Documentation ownership

- The overview is a map; summaries help select features. Neither replaces a full spec for implementation.
- Each feature folder has exactly `SUMMARY.md` and `SPEC.md`. Keep summaries short; store authoritative behavior once and link shared contracts.
- Follow [the feature-writing guide](ADDING_FEATURES.md) when defining or revising a capability; documentation changes do not authorize implementation.
- Preserve original numbered section references (for example, `4.3`); cite a numbered item or distinctive bullet when tracking individual requirements. Add stable IDs for new requirements.
- Change requirements in their owning spec, then update affected summaries, links and traceability. Resolve conflicts explicitly; do not let summaries silently override required behavior.

The implementing AI coding agent **MUST** follow this process for each agreed feature scope:

1. **Read selectively:** keep [the overview](OVERVIEW.md) and [shared principles](PRINCIPLES.md) in context. Check [progress](PROGRESS.md), relevant traceability rows and ADRs; select feature summaries, then load full specs and affected dependency/security contracts for the current task. Inspect actual architecture, source and tests; do not assume the project is greenfield.
2. **Choose the feature set together.** If no scope is selected, review available features with the user and explain relevant dependencies, value and trade-offs. Agree on the outcome, included requirements and acceptance checks. Once selected, write a concise plan covering affected modules, risks, migrations/security and tests; complete the authorized work without repeated approval for routine steps. Do not impose a fixed feature order.
3. **Prefer vertical slices.** Deliver one demonstrable user workflow end-to-end before expanding scaffolding to many theoretical modules.
4. **Document decisions** in ADRs, separating required behavior from chosen technology. Resolve architecture, repository layout, CI/test/lint/format conventions, secrets policy and developer setup as the selected work needs them. Record unknowns and assumptions; do not invent vendor policies, licenses or capabilities. [Technology candidates](TECHNOLOGY_CANDIDATES.md) are nonbinding. Keep setup and documentation proportional to real work.
5. **Implement behind contracts/interfaces** for models, providers, tools, runners, storage and domain integrations. Avoid speculative abstraction that has no test or actual second implementation when it can wait.
6. **Write and run tests**; report the commands, outputs and limitations. Never claim a build or visual validation passed without running it.
7. **Review security**: cross-repo ACL, untrusted data, tool permission, secrets and external data routing for any affected changes.
8. **Update docs and traceability**: status `not-started / in-progress / validated / deferred`, actual evidence links/commits, known defects, migration steps and any agreed follow-up.
9. **Review the completed scope**: show the real input-to-result workflow, reviewable artifacts, actual tests, risks, compatibility and quality limits. Discuss the next feature set with the user; do not autonomously start unrelated features or invent a future delivery sequence.
10. **Never destroy existing user work** to satisfy the task. Use branches/checkpoints/reversible migrations. Require approval before publishing, deploying, installing risky tools, changing production secrets or merging work that can overwrite another user.

Before a handoff or context reset, refresh [progress](PROGRESS.md) with the agreed scope/requirement references, completed and remaining work, relevant file paths, actual test commands/results, blockers and the next concrete action. Record the branch/commit when available. On resumption, check current files and Git changes against that handoff; earlier verification is evidence, not a guarantee about later edits.

## Required engineering artifacts as the project grows

```text
docs/
  OVERVIEW.md                     # compact product map
  PRINCIPLES.md                   # shared invariants
  features/<feature>/
    SUMMARY.md                    # purpose, scope, related features
    SPEC.md                       # authoritative detailed requirements
  PROGRESS.md                     # completed/active/blocked/planned, evidence
  REQUIREMENTS_TRACEABILITY.md    # requirements ↔ source/tests/status
  architecture/                   # design/data flows/runtime/auth/runner/retrieval
    decisions/                    # ADRs, including rejected alternatives
  security/                      # threat model, secrets and data policy
  operations/                    # development, upgrades, restore, incidents
  api/ or schemas/               # versioned contracts
```

These are illustrative names. Keep documentation proportional to what is actually implemented; don't generate empty placeholder essays.
