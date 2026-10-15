# Evidence-based model evaluations and shadow tests

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 5.3 Evaluations

- Maintain repeatable workspace-specific evaluations for code implementation, architecture, debugging, tool use, summarization, retrieval-grounded reasoning, vision critique, creative writing and structured decisions.
- Compare models by validated correctness/quality, completion rate, tool reliability, latency and cost, not invented 1–10 scores. Use known task fixtures, tests, optional blind human review and source-grounded grading.
- Allow approved **shadow tests** of candidate models in no-side-effect sandboxes, including redaction/privacy constraints and cost ceilings. Shadow runs must never mutate production state or leak data to unauthorized providers.
- Promotions to default model profiles are deliberate policy/configuration changes, not autonomous benchmark-based replacements without authorization.

**Product acceptance:** G6 in [acceptance scenarios](../../ACCEPTANCE.md).
