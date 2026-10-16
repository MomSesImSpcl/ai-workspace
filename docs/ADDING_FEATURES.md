# Adding or changing a feature

Use this guide when the user asks to define, expand, split or revise a feature. Documentation work does not authorize application implementation.

When a discussion or implementation turns up a capability that is distinct from the current feature or would grow its scope, suggest it to the user as a new or split feature instead of silently folding it in. Write it up with this guide only after the user agrees.

## Find the owner

Read the [feature map](OVERVIEW.md), relevant summaries and [shared principles](PRINCIPLES.md). Extend an existing spec when it owns the behavior. Create a new folder only for a distinct capability with a clear purpose. Split by responsibility, not document length alone.

Use the user's requested behavior. Do not add speculative modes, providers, configuration or infrastructure. Mark proposals, assumptions and unresolved decisions explicitly; do not turn them into agreed requirements. Ask about material ambiguity and continue independent work where possible.

## Write two files

Use `docs/features/<short-kebab-case-name>/` with exactly:

- **SUMMARY.md:** descriptive title, a `**Status:**` line (`not-started`, `in-progress: <what>`, `validated` or `deferred: <reason>`), a short paragraph explaining purpose and scope, a link to `SPEC.md`, and links to relevant dependency summaries. Aim for 50–120 words; it should let an agent decide whether to read more.
- **SPEC.md:** authoritative behavior and acceptance criteria, with enough detail to implement without guessing. Cover relevant inputs/outputs, user controls, state/data ownership, permissions/privacy, dependencies, failure/recovery behavior, compatibility and observable checks. Include non-goals and open decisions when they clarify scope; omit empty or irrelevant sections.

Detailed means precise, not repetitive. Prefer concrete requirements and examples that resolve ambiguity. Link shared contracts and other feature specs rather than copying them. Distinguish required behavior from optional implementation examples; do not prescribe a technology without an agreed reason.

Use MUST/MUST NOT, SHOULD and MAY as defined in the shared principles. Preserve existing section/item references when editing. Give new requirements stable IDs such as `memory-001`; never renumber existing IDs or reuse deleted ones. Preserve mandatory language and user-control guarantees when shortening text.

Dependencies describe required capabilities or integration contracts, not a fixed development order. Do not assign delivery phases, fixed priority labels or dates unless the user requests them. A partial implementation must identify which requirements it covers.

## Register and check

1. Add or update one descriptive title, summary path and status marker in the [overview](OVERVIEW.md). Keep the map compact; do not copy the full summary into it.
2. Add the requirement references, owning spec and relevant checks to [traceability](REQUIREMENTS_TRACEABILITY.md). Mark new behavior `not-started` until implemented; distinguish specification completion from application completion.
3. Update affected dependencies and shared contracts only when behavior actually changes. Record changes to shared requirements explicitly; do not silently weaken security or data boundaries. Keep feature-specific questions in its spec; cross-cutting choices may belong in [open decisions](OPEN_DECISIONS.md).
4. Keep [progress](PROGRESS.md) compact with current state, unresolved decisions and the next agreed action. Record completed documentation work and detailed verification as a `history/YYYY-MM-DD-NN-name/` folder under the [progress/history contract](WORKING_AGREEMENT.md#progress-and-history). Do not invent an implementation commitment.
5. Check both feature files exist, local links resolve, the overview and traceability point to them, requirements do not conflict or repeat across owners, and acceptance checks describe observable results. Review edited requirements against the user's request; do not discard details while compressing.

When renaming, splitting or removing a feature, update every incoming link and preserve or explicitly supersede its requirement references. Change only the user-authorized scope.
