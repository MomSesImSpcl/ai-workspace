# 2026-10-17 — Codex capability check

**Scope:** user request to check the matrix's open Codex cells with the real Codex CLI.

**Environment:** codex-cli 0.163.0, Windows 10, the workspace's dedicated `CODEX_HOME`, a temporary folder outside any repository.

**Real runs:**
- `codex exec --json --skip-git-repo-check -s workspace-write -c approval_policy="never" "<create note.txt containing kiwi>"`: exit 0; events `thread.started`, `turn.started`, two `item.completed` agent messages, `turn.completed` with usage. The write was rejected ("blocked by policy", stderr); no event described the rejected command, and no file was created.
- `codex exec resume --json <thread id> "Which word did I ask you to write?"`: same thread id, answer "kiwi", so native resume keeps context.

**Protocol schema (not exercised):** `codex app-server generate-json-schema` lists `turn/start`, `turn/interrupt`, `thread/resume`, `item/agentMessage/delta`, `item/started`/`item/completed`, command/file-change output deltas, `item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, `item/permissions/requestApproval`, `thread/tokenUsage/updated`, `account/rateLimits/read`/`updated` and `config/read`. The command is marked experimental.

**Outcome:** matrix cells updated (new status `checked`); sessions open decision now asks whether to build the Codex session adapter on the experimental app-server protocol. Remaining `verify`: Claude Code permission reading, approval relay and limit detection; Codex limit text in `exec`; Codex writes on Windows.

**Commit:** see branch `claude/ui-feature-suggestions-a7df7e`.
