# Codex capability check

Checked the integration matrix's Codex cells against codex-cli 0.163.0 on Windows. Native thread resume works with `codex exec resume`. `codex exec --json` cannot stream text deltas, report mid-turn usage or relay approvals; the experimental `codex app-server` protocol provides all of these according to its schema. A workspace-write file write was rejected on Windows. [Integration matrix](../../INTEGRATIONS.md) updated.

[Details](DETAILS.md).
