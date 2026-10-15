# Project instructions

This is the AI Workspace repository. Start here when opening or resuming work.

1. Read [the feature map](docs/OVERVIEW.md), [shared principles](docs/PRINCIPLES.md) and [progress](docs/PROGRESS.md). Keep these compact references in context; do not load the whole specification tree.
2. Resume an explicitly agreed active scope from progress, checking the current files and Git state first. Use the recorded next action, relevant requirement rows, evidence and ADRs. If the scope is missing, contradictory or blocked by a user decision, clarify it with the user.
3. If no scope is active and the user has not selected one, start with the feature titles in the map and discuss what to build together. Open only short summaries useful to that discussion. Keep selection context minimal; do not load full specs or inspect implementation code to choose a feature unless the user requests that deeper analysis. There is no preset order; explain known dependencies without inventing a delivery sequence.
4. Once the user and agent agree on a feature set and outcome, load its full specs and affected dependency/security sections, then plan, implement and verify that scope. Follow [the working agreement](docs/WORKING_AGREEMENT.md); complete authorized work without repeated approval for routine steps.
5. When adding or changing feature definitions, read [the feature-writing guide](docs/ADDING_FEATURES.md). Specifying a feature does not authorize implementing it.
6. Before finishing or handing off, update progress and affected traceability with completed work, remaining work, relevant files, actual verification, blockers and the next concrete action. Keep agreed work separate from suggestions; never claim implementation or tests without evidence.

Preserve user changes and shared security boundaries. Requirements belong in their owning specs; summaries and this file should link to details rather than duplicate them.
