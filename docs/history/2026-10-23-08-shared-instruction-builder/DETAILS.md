# 2026-10-23: shared instruction builder

**Scope:** first increment of iteration one of [ADR 0023](../../architecture/decisions/0023-one-agent-interface.md) (one agent interface; ADR on the `claude/unified-agent-contract` pull request). Effort: medium (user).

**Outcome:**
- `app/src/prompt.ts`: `agentInstructions(session, { effort, workspaceRules })` builds the role notes for every agent: effort note, task note, read_repo, delegate, orchestrator note, start_task, the user's own instructions, merge note, workspace folder rules. Workspace tools are named neutrally ("the workspace start_task tool").
- `app/src/adapters/claude-code.ts` passes it as `--append-system-prompt`; `app/src/adapters/codex.ts` as `developerInstructions`. Neither adds rule text any more; Codex keeps only which runs get the workspace tools, the orchestrator's sandbox and approvals.
- Changes for the agents: Claude Code reads "the workspace start_task tool" / "the workspace delegate tool" instead of `mcp__aiws__…`; Codex gets the effort note; a Codex orchestrator's notes now start like every other ("AI Workspace session: effort level …").
- `app/src/instructions.ts`: the pairs "Effort level note"/"Developer instructions heading", "Start tasks from a chat" and "Delegate subtasks" merged into one entry each (42 entries).

**Checks:** `npm run typecheck` clean; `npm test` 115/115 on Windows. New test in `app/test/tasks.test.ts`: a chat, an orchestrator chat and a task get byte-identical instructions from the fake Claude Code and the fake Codex. The catalog's fidelity test checks the merged entries against `prompt.ts`.

**Not verified:** real agents. Next: in a test instance of this branch, a Claude Code and a Codex chat each start a task, and a task delegates, as before.

**Branch:** `agent-instructions`, uncommitted.
