# 2026-10-23: one agent interface, code over instruction text

**Scope:** shared principles 11 and 12, [ADR 0023](../../architecture/decisions/0023-one-agent-interface.md), amendment note in ADR 0006, ADR index, progress.

**Why:** reading the instruction catalog of the agent instructions browser (branch `agent-instructions`, not merged yet) showed duplicated Claude Code and Codex versions of the same rules, prompts assembled per adapter, features only one agent gets, and many rules that are prose an agent can ignore. The user once gave Codex an instruction only Claude Code could follow.

**Decided (user):** one adapter interface; the same tools for every agent, a need of one added for all; capability gaps filled by the workspace or one shared fallback; code over instruction text. Order: unified interface and builder, capability parity, rules into schemas and code, editing.

**Checks:** documentation only; private-data scan clean.

**Branch:** `claude/unified-agent-contract`.
