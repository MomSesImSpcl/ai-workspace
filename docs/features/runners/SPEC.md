# Secure local and remote execution runners

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 3.2 Central service and remote runners

- Support at least one local runner and eventually multiple registered runners. Each reports operating system, capabilities, current availability and resource limits.
- Remote commands travel from the control plane to a registered runner over an authenticated encrypted channel. **Do not expose a workstation's Unity/MCP/process-control interface directly to the public internet.** Prefer workstation-initiated outbound connections.
- Runner jobs must carry user/task identity, scoped credentials/capabilities, resource estimates, expiration, cancellation token and an idempotency/deduplication key where possible.
- Runner offline behavior: jobs requiring that runner wait safely; central task state persists; independent cloud steps can continue if allowed. Resume only after validating current authorization and task state.
- A runner may be a full desktop, headless worker machine, GPU node or secure sandbox. Never assume all clients have the same installed software.
- Maintain a local cache for downloaded approved tools, project index metadata and resumable work when useful; distinguish source of truth from cache.

**Product acceptance:** G11 in [acceptance scenarios](../../ACCEPTANCE.md).

## Acceptance evidence

- Demonstrate secure registration/heartbeat, workstation-initiated control-plane communication and safe offline/reconnect behavior. Local steps wait for an authorized runner while independent permitted cloud steps can continue.
