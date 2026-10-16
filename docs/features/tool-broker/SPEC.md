# Typed tools, MCP and scoped execution

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 6.2 Capability broker/tool actions

The separate [Hermes Agent and Hindsight feature](../hermes-hindsight/SPEC.md) evaluates product-specific native/MCP access paths. Tool validation, scoped authority and audited execution remain owned here; an external agent's built-in tools cannot bypass these contracts.

- Define typed tool operations with validated inputs/outputs, rich error types, timeouts, cancellation, permission requirements, dry-run where possible, audit data and tool version.
- Support MCP servers, local CLI commands, first-party adapters and normal web APIs. Their interfaces are standardized at the workspace level, not necessarily the same across vendors.
- MCP processes are executable programs and must be governed by the same trusted-tool and scope policies as other tools. Do not permit arbitrary untrusted MCP installation/configuration from a project manifest.
- Design extension points so projects can register approved domain actions, including project-specific Unity commands (e.g. `CreateStoreShelf`) without modifying the core.
- Tool resolution may select among equivalent providers, but the user/admin can constrain the approved set, prefer certain providers or require human review.

**Product acceptance:** G5 in [acceptance scenarios](../../ACCEPTANCE.md).

## Acceptance evidence

- Run at least one real MCP/integration through the broker with validated schemas, scoped permissions and audit evidence. Replace a provider behind one semantic capability without rewriting its calling skill; reject malicious or unauthorized project commands.
