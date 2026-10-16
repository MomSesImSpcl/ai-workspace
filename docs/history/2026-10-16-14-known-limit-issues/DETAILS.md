# 2026-10-16 — Known limits moved to GitHub issues

- **Scope:** user request: one place to see what is still open.
- **Outcome:** labels `known-limit` and `feature:{task-runtime, tool-broker, model-routing, identity-projects, ai-orchestrator, distribution}`; issues [#1–#10](https://github.com/MomSesImSpcl/ai-workspace/issues?q=label%3Aknown-limit) filed from ADR 0001 known limits, traceability notes, code `shortcut:` comments, plus one new item (#9, no fallback when `--resume` fails). [ADR 0001](../../architecture/decisions/0001-core-slice-stack.md#known-limits) keeps the design explanation and links the issues; [traceability](../../REQUIREMENTS_TRACEABILITY.md) rows link their open issues; `app/src/store.ts` shortcut comment references #5. Rule added to the [working agreement](../../WORKING_AGREEMENT.md) step 8 and AGENTS.md. History snapshots unchanged.
- **Checks:** `gh issue list --label known-limit` lists 10 open issues; links resolve.
- **Branch / commit:** pushed to `main`; commit ID from Git.
