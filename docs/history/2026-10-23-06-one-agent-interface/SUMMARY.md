# Decision: one agent interface, code over instruction text

The user decided that every agent integration implements one shared interface with the same instructions, tools and lookups, no agent-specific instruction text, and that rules the workspace can enforce are built in code rather than written as instructions ([principles 11–12](../../PRINCIPLES.md#product-invariants), [ADR 0023](../../architecture/decisions/0023-one-agent-interface.md), amends ADR 0006). Documentation only; nothing is built.

[Details](DETAILS.md).
