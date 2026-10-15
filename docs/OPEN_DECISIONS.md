# Open implementation decisions


These are **not reasons to halt all work**, and the implementing agent should propose a recommendation with evidence when each becomes relevant to the selected feature work:

1. Initial development and testing OS, supported CPU architectures, minimum workstation specifications, and the cross-platform build/test strategy for Windows, Linux, and macOS. Support for all three operating systems is mandatory; only their implementation order remains undecided.
2. Initial local-only prototype versus centrally hosted control plane; hosting/availability/backup strategy when mobile or employees arrive.
3. GitHub integration mechanics and precise authorization refresh semantics; behavior for non-Git projects.
4. Modularity boundary: monolith versus separate worker services and whether/when Temporal is justified.
5. Exact primary persistence/search/index technologies and dataset retention policies.
6. Runner-to-control-plane protocol, secure provisioning lifecycle and job identity/sandbox details.
7. Cloud-model privacy consent defaults, provider allowlists, data residency and cost budgets.
8. Skill/package distribution, signing, update and conflict semantics.
9. When a task's changes can be applied automatically versus requiring human review.
10. Supported Unity/render-pipeline configurations for off-screen capture, multiple Editor processes and tool versions.
11. Technology Catalog initial allowed sources and each source's API/licensing terms.
12. Whether task approval/notifications are available through mobile for each risk category.
13. Data lifetimes for conversations, model traces, source cache, screenshots/video and completed task artifacts.

**Final implementation principle:** Features and trust boundaries are the specification. The stack is a candidate implementation. A usable, secure, tested slice delivered iteratively is preferable to a grand but incomplete implementation.
