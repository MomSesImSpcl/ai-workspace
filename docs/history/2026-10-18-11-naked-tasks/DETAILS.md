# Naked tasks: details

Branch `claude/lean-agent-setup`. Same method as [history 10](../2026-10-18-10-lean-orchestrator-and-tasks/DETAILS.md): real runs through the app code on a scratch store, one model call.

## The user's test

The user ran two orchestrator chats (Codex orchestrator, Claude Code tasks), each creating an empty text file. The tasks showed 53,711 and 12,978 tokens at real cost. The first was a cold prompt cache: about 42k tokens written at 125 %. The second read the cache at 10 %. Both runs wrote to the 1-hour cache (`ephemeral_1h_input_tokens`), which Anthropic prices at 2x the base input rather than 1.25x, so cold starts likely cost more than shown (onboarding-009, not built).

## Decisions (user, 2026-10-18)

- The implementer runs naked: everything it uses is picked by the orchestrator. A task without a tool fails with a visible error, and a missing item is resolved automatically and visibly.
- The agent's own system prompt is an item as well, so it loads only when a task needs it.
- No map from task types to tools, since the orchestrator would then enable items to be safe.
- The user's always-on choice stays in Settings.
- Codex parts without a switch stay; the rest are switched off.

## Measured switches

- Claude Code task (from 42,207): `--tools ""` 8,218; with `--system-prompt` replaced as well 5,167; Read, Write and Edit with the short prompt 6,463.
- Codex task (from 17,281, one flag at a time): `features.memories=false` 13,460; `features.shell_tool=false` 16,431; `features.goals=false` 16,665; `features.image_generation=false` 16,754; `baseInstructions` replaced 13,079; all together 7,265. No effect: `web_search`, `tool_suggest`, `multi_agent`, `collab`, `unified_exec`, `include_apply_patch_tool`, `apply_patch_freeform`, `tools.view_image`, `code_mode`, `subagents`, `request_user_input`, `view_image_tool`, `js_repl`.

## Real behaviour

- A Claude Code task given only Read and asked to create `hello.txt` called `request_setup` for Write and Bash with a reason. The notice appeared in the task and the chat. The task continued in a new process with the message "The workspace enabled tool:Write, tool:Bash. Continue the task." and created the file.
- An earlier run, before `delegate` became an item, handed the work to a subtask first. That is why `delegate` is now an item.
- Asked to create a file, the Claude Code orchestrator started its task with `setup: ["tool:Write", "tool:PowerShell"]`. The Codex orchestrator, without its base prompt, used `setup: ["feature:shell_tool"]`.
- After runs: Claude Code orchestrator 8,929; task with only Read 6,341; Codex orchestrator 6,598; Codex task 7,297.

## Build

- `app/src/setup.ts`: item kinds `tool`, `feature`, `prompt`, `workspace` (`DELEGATE`); `itemOn`, `toolsFor`, `checkRequest`, `minimalPrompt`.
- `app/src/adapters/claude-code.ts`: one item per built-in tool (shortcut: a fixed list for 2.1.301), the `prompt` item, `--tools` with the picked tools, `--system-prompt` when the prompt is off.
- `app/src/adapters/codex.ts`: `feature:` items for `features.*`, the `prompt` item as `baseInstructions`.
- `app/src/tasks.ts`: the refusal in `createTask` for a chat's task; `requestSetup`; a task based on an earlier one keeps its items; `delegate` passes the parent's items to a subtask of the same agent.
- `app/src/turn.ts`: a changed setup restarts the process; `continueWithSetup` adds the continue message after the turn.
- `app/src/approval-server.ts`: `request_setup` for every task; `delegate` only when the item is on.

## Verification

`npm test` 49/49. The setup test covers the refusal, unknown and switched-off requests, the notices in the task and the chat, and the continuation in a new process with the added item. `npx tsc` reports no errors. The naked tasks were not run in the app; the measurements used the app code directly.

## Open

- Not measured: whether naked tasks do worse on larger work, for example without Claude Code's own git guidance.
- In the real run the task asked for Bash as well as Write, only to verify the result; the cost of over-asking is visible in the request's reason.
