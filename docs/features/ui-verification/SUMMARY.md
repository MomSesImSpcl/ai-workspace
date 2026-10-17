# Runtime UI verification in an isolated test instance

**Status:** not-started

Start the app under development in an isolated instance and check what the user would actually see: real DOM, computed styles, visibility, interaction results, console errors and screenshots. Agents use it to verify UI changes with evidence; results stay separate from the static code index. Project-agnostic, with this workspace's Electron app as the first target.

[Full requirements](SPEC.md).

**Dependencies / related features:** [code-index](../code-index/SUMMARY.md), [self-development](../self-development/SUMMARY.md), [software-workflow](../software-workflow/SUMMARY.md), [tool-broker](../tool-broker/SUMMARY.md), [runners](../runners/SUMMARY.md).
