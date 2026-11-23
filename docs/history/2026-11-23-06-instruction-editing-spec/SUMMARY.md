# Instruction editing specified, entry view simplified

The Agent instructions tab will hold every default instruction and let the user override or append to any text form, in every build, with the registry text as fallback ([agent-instructions-006–011](../../features/agent-instructions/SPEC.md#defaults-and-overrides-specified-2026-11-23-user-adr-0025), [ADR 0025](../../architecture/decisions/0025-instruction-overrides.md)). Built now (007): each entry shows one description under its title, its id and any agent gap; "Used by", "When included", "How it reaches the agent" and "Source" are gone. Agents get the same text. Tests 120/120, browser-checked.

[Details](DETAILS.md).
