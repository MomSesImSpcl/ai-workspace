# Typed tools, MCP and scoped execution

**Status:** in-progress: workspace MCP server with `approve` and the workspace tools (`delegate` removed, [ADR 0024](../../architecture/decisions/0024-no-delegate.md)), audit (ADR 0009); core slice 1's scoped file tools, write grants and effect ledger removed

Mediate typed actions across approved MCP servers, CLIs, APIs and adapters. Validate inputs, outputs and scopes; provide errors, timeouts, cancellation and auditing. Permit approved domain actions without changing the core. Per [ADR 0004](../../architecture/decisions/0004-agent-native-permissions.md), agents will use their own tools and permissions; the broker remains for workspace-owned tools such as `read_repo`.

[Full requirements](SPEC.md).

**Dependencies / related features:** [identity-projects](../identity-projects/SUMMARY.md), [provisioning](../provisioning/SUMMARY.md).
