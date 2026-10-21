# 2026-10-21: More visible update-button pulse

Scope: toolbar update-state indication under [selfdev-005](../../features/self-development/SPEC.md#requirements), following [UI style](../../UI_STYLE.md).

Changed `app/src/ui.html`: peak spread 4 px → 6 px; peak accent opacity 32% → 42%, derived from `--accent` via `color-mix` rather than a literal colour. The 1.6 s easing, default-state behavior and steady 2 px reduced-motion border are unchanged. No dependencies, state logic or security boundaries changed; no new architectural decision.

Branch: `update-button-pulse`; uncommitted at recording. Visual verification not run; confirm appearance in the app after merge.

Checks: `npm.cmd run typecheck` passed; `npm.cmd test` passed 89/89 outside the Windows sandbox. The first sandbox run passed 84/89, with five restart tests reporting dirty fixture repositories while Git emitted permission warnings; the approved unrestricted rerun passed all five. CI private-data regex scan and staged diff review passed before commit.
