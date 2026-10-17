# Typed tools, MCP and scoped execution

**Status:** in-progress: scoped MCP file tools, write grants, audit, effect ledger (core slice 1)

Mediate typed actions across approved MCP servers, CLIs, APIs and adapters. Validate inputs, outputs and scopes; provide errors, timeouts, cancellation and auditing. Permit approved domain actions without changing the core. Per [ADR 0004](../../architecture/decisions/0004-agent-native-permissions.md), agents will use their own tools and permissions; the broker remains for workspace-owned tools such as `delegate`.

[Full requirements](SPEC.md).

**Dependencies / related features:** [identity-projects](../identity-projects/SUMMARY.md), [provisioning](../provisioning/SUMMARY.md).
