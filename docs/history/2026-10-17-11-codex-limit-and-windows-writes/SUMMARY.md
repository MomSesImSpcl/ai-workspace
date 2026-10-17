# Codex usage-limit message and Windows write block

Last two `verify` cells of the [integration matrix](../../INTEGRATIONS.md) resolved by research, without new runs that write or exhaust limits. Codex's limit message is user-reported as "You've hit your usage limit. Try again at <time>" (or an upgrade hint); detection should use the app-server rate-limit events. The blocked Windows write came from a disabled Windows sandbox with approvals set to never.

[Details](DETAILS.md).
