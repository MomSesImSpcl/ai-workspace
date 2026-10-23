# Runtime UI verification in an isolated test instance

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

Static analysis ([code-index](../code-index/SPEC.md#721-language-analysis)) can only say which selectors and handlers *might* apply. This feature checks the running UI.

## Requirements

- **uiverify-001 — Isolated instance:** Verification MUST run against a separate instance of the app under test (browser page, Electron window or dev server), never the instance the user is working in. For this workspace the instance runs from the change's worktree with its own storage folder (`AI_WORKSPACE_HOME`) and its own port, so it cannot read or change the user's real projects, sessions or tasks. It MUST be able to run while the user's own instance is open. The user's own test instance of a branch ([selfdev-009](../self-development/SPEC.md#requirements)) is the starting point: verification reuses how it is started and isolated.
- **uiverify-002 — Inspect:** Agents can read the actual DOM, computed CSS, element visibility and layout boxes, focus and interaction state, console errors and network failures, and take full or element screenshots.
- **uiverify-003 — Interact:** Agents can click, type, press keys and wait for a condition, so a check can follow a user flow (for example open a project, start a session, see the reply).
- **uiverify-004 — Assertions:** A check states expected results (element present and visible, text, computed style value, no console errors) and returns pass/fail per assertion with the evidence behind it. Checks MAY be saved in the project and rerun as regression tests; screenshot comparison is optional and MUST report the diff image, not only a score.
- **uiverify-005 — Labeled results:** Runtime findings MUST be labeled as observed at runtime, with the instance, revision and time, and kept apart from static index relationships. A runtime result MAY confirm or contradict a static link but MUST NOT be stored as one.
- **uiverify-006 — Permissions and cleanup:** Starting the instance, opening pages and running scripts go through the [tool broker](../tool-broker/SPEC.md) and the project's permissions. The test instance gets only test data; real credentials are never typed into it. The instance and its temporary storage are removed after the check unless the user keeps them for inspection.
- **uiverify-007 — Unavailable:** When no browser runtime or test instance can start, report that explicitly with the reason; never report a UI check as passed without running it.

Agent dependence: agents reach these tools through the workspace MCP server, like the workspace `delegate` tool ([integration matrix](../../INTEGRATIONS.md), row "Delegate to a child task"); no agent-specific browser support is required.

## Acceptance evidence

- Change one visible element in `app/src/ui.html` in a worktree; an agent starts an isolated instance from that worktree, confirms the change through DOM and computed style, attaches a screenshot and reports no console errors, while the user's own instance keeps running with unchanged data.
- A deliberately broken handler fails its assertion with the console error as evidence.
- With the browser runtime missing, the check reports "unavailable" instead of passing.

## Non-goals and open decisions

- Not a general web-automation or scraping tool; not a replacement for unit tests or human review. Using websites on the user's behalf belongs to [integrated-browser](../integrated-browser/SPEC.md).
- Open: which [technology candidate](../../TECHNOLOGY_CANDIDATES.md) drives Electron; format of saved checks; whether visual comparison is in the first slice.
