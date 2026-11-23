# 2026-11-23: role notes trimmed

**Decided (user):** the effort line is the user's own concern (their rules, not a workspace note); a sentence that only describes tool use is not needed; the user's own instructions are added without a preamble; rules that can be enforced should not be sent as text. Plain chats keep start_task and worktrees for now (a later feature decides what chats may do). Follow-up specified the same day: [agent-interface-009](../../features/agent-interface/SPEC.md#iteration-two-capability-parity), workspace file and command tools whose descriptions carry the rules they enforce.

**Outcome:**
- `app/src/registry.ts`: `note.chat` removed; `note.orchestrator` is the routing rules and `note.task` the background-task sentence, each with only the workspace-rules section. The effort line, the read_repo and start_task hints, the own-instructions wrapper and the merge section are gone.
- `app/src/prompt.ts`: `agentInstructions` returns the role's note (none for a plain chat) and then the user's own instructions as written, joined by a blank line; '' when there is neither. Both adapters send no system text when it is empty.
- `app/src/merge.ts` `noPublishEnv`, used for Claude Code worktree sessions (`app/src/adapters/claude-code.ts`): no `GH_TOKEN`/`GITHUB_TOKEN`, an empty `GH_CONFIG_DIR`, git's credential helper list reset by an empty `credential.helper`, and no password prompt. Shortcut: a remote over SSH keeps the user's keys.

**Checks:** `npm run typecheck` clean; `npm test` 128/128 on Windows; new test for `noPublishEnv`; the instruction test now expects no system text for a plain chat and the user's text after the orchestrator note. Real check on this machine: with that environment, `git push --dry-run` to GitHub stops with "could not read Username … terminal prompts disabled".

**Not verified:** a real worktree chat working without the merge note (it learns request_merge from the tool description and the guard's refusals).

**Branch:** `claude/agent-instructions-e69c98` (this worktree), committed locally, not pushed.
