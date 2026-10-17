# Version control in the workspace

**Status:** not-started

Projects are local; version control is how they go online and how teams share them ([identity-projects 1.4](../identity-projects/SPEC.md#14-workspace-and-local-projects)). This feature lets the user clone or check out a project into the workspace and do the everyday operations from the UI without asking an agent: see changes, commit, pull, push, view history and switch branches. Git first, through a provider seam so Perforce and other systems can follow. Credentials stay with the version-control tools.

[Full requirements](SPEC.md).

**Dependencies / related features:** [identity-projects](../identity-projects/SUMMARY.md), [desktop-client](../desktop-client/SUMMARY.md), [tool-broker](../tool-broker/SUMMARY.md), [sessions](../sessions/SUMMARY.md).
