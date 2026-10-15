# Internal artwork and identity similarity screening

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 11.5 IP/similarity review workflow

For fictional game artwork/logos/identities inspired by real-world games:

- Automate an **internal similarity-risk review** pipeline with deterministic checks plus capable vision comparison and structured atomic decisions (name/wording, logo, character, composition, publisher/developer similarities, distinctive objects, trade dress and direct reuse).
- Process thousands of items efficiently in batches; route uncertain/high-risk items to deeper visual review and ultimately human/legal review as needed.
- A dedicated structured decision model (e.g. Jev/TypeSafe) is **optional** and should only be used if it adds value beyond rules/local models. It must not be on the request path for unrelated tasks.
- Review outcome is `pass internal check / needs review / fail internal check`, **never “legally approved”**. The AI may recommend changes and regenerate candidates, but it is not a legal authority.
- Record which original/reference was compared and the human decision/iteration history, subject to rights and data permissions.

**Product acceptance:** G13 in [acceptance scenarios](../../ACCEPTANCE.md).
