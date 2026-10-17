# 2026-10-17 — Sessions slice 1

**Scope (agreed with the user):** [sessions](../../features/sessions/SPEC.md) 001–006 (sessions per project, durable history, list), 007/008/020 (live activity, collapse or marker, event contract), 010 (Stop), 018/019 (permission summary, approval cards) for Claude Code, replacing the interim chat-as-task column. Codex stays on `codex exec` (user decision, [ADR 0005](../../architecture/decisions/0005-session-turn-runner.md)).

**Outcome:**
- `app/src/sessions.ts`: session files and an append-only event log per session in workspace storage; every event also goes to `audit.jsonl`. `turns()` folds the log into turns; a turn without an end event whose runner is gone is interrupted. The marker ("Stopped/Interrupted/Failed after step N: …") is recorded when the user continues and is sent to the agent with the next message (part of sessions-009).
- `app/src/turn.ts`: detached `ws turn <id>` runner, one agent process per turn; Stop marker ends the process tree.
- `app/src/adapters/claude-code.ts`: session agent with the user's own tools, settings and rules, streamed text deltas, activity labels, outside-project edit flag, permission summary from settings files, retry from workspace history when the vendor session is unknown.
- `app/src/approval-server.ts`: `--permission-prompt-tool` MCP server; each "ask" becomes an approval card, the answer goes back as allow/deny; Stop denies a pending request.
- `app/src/adapters/codex.ts`: session agent on `codex exec` with the user's config; conversation sent as text; activity from completed command and file-change items.
- `app/src/ui.ts`, `app/src/ui.html`: session API and chat column (list with search and archived filter, new, rename inline, archive/restore, delete with confirmation saying tasks are kept, working dot and pending-approval badge, approval cards, Stop). Task creation moved to a form on the Tasks page; old task conversations are shown read-only in the task details.
- Agent and model come from the role chosen for a new session: the user's global Claude settings name a model (`caveman-auto[1m]`) that only the desktop app resolves, so headless `claude` failed until the role's model was set (here `sonnet`).

**Checks:**
- `npm test`: 28/28 (10 new in `app/test/sessions.test.ts`); `npx tsc` clean.
- Real Claude Code 2.1.301 runs through the turn runner (temp project with `ask: ["Bash"]`): resume across turns, streamed text, activity list, approval card denied and allowed, collapsed "Worked 20s · 2 steps". Stop during an allowed `ping -n 40` left the activity expanded with "Stopped before the first step"; no agent, ping or approval-server process remained.
- Real Codex session in the UI: reply "PONG" with the user's config (approval default, sandbox workspace-write); rename and archive/restore in the UI.
- Observed: the user's global `CLAUDE.md` effort rule applies in sessions (ADR 0004 intends user rules to load); Claude Code's own hook rewrote the approved command to `rtk ping …`, and the card showed the rewritten command.

**Not done / limits:** sessions-002 (tasks started from a session), 009 turn-start project state (sessions-021), 011–017, 021–024; live usage during a turn (shown per reply at turn end); managed Claude settings are not read for the summary; Electron window itself not opened in this run (UI tested in the browser pane against the same server); [#14](https://github.com/MomSesImSpcl/ai-workspace/issues/14) Codex asks are denied; pid-file liveness ([#12](https://github.com/MomSesImSpcl/ai-workspace/issues/12)) also applies to turn runners.

**Branch:** `claude/chat-sessions-per-project-f82af3` (commit follows this entry).
