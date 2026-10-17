# 2026-10-17 — Codex usage-limit message and Windows write block

**Scope:** user request to find Codex's usage-limit output online (no own test) and why a Codex file write was refused on Windows.

**Usage limit (web research only):** OpenAI community reports show the message "You've hit your usage limit." followed by "Try again at <date time>", or a plan-dependent upgrade hint instead; some reports show it while `/status` still shows remaining quota. A third-party wrapper matches "You've hit your usage limit" and "insufficient_quota". No source documents the `exec --json` event shape or exit code. Conclusion: use the app-server `account/rateLimits/*` events for detection; text matching only as a fallback.

**Windows write block:** `codex doctor` (read-only diagnostics, dedicated `CODEX_HOME`) reports "filesystem sandbox restricted", "approval policy OnRequest" by default and "sandbox backend disabled"; that home has no `config.toml`. OpenAI's docs list Windows sandbox implementations (MXC preferred via `features.prefer_mxc`, with `elevated` and `unelevated` as fallbacks in `windows.sandbox`). Inferred cause: with no sandbox backend, the write could not run sandboxed and required approval; the run's `approval_policy="never"` rejected it ("blocked by policy"). Not confirmed by a run with a configured sandbox.

**Sources:** OpenAI community threads on "You've hit your usage limit"; learn.chatgpt.com "Agent approvals & security" (redirect from developers.openai.com/codex/agent-approvals-security).

**Commit:** see branch `claude/ui-feature-suggestions-a7df7e`.
