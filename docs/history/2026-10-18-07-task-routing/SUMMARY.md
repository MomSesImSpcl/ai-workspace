# Task routing after the user's test, and the default task mode

After the user's test, the orchestrator no longer reuses finished tasks.

- Only a running or paused task gets messages; they are queued until its current step ends.
- New work, even like earlier work, becomes a new task with `basedOn`: it starts with the earlier task's goal and last reply.
- The user continues a finished task from the reply field under its card.
- A task's card moves to the turn that last messaged it.
- A chat's tasks run in `acceptEdits` by default, with a mode picker next to the chat box.

Workspace-wide permission settings are specified as [agent-permissions](../../features/agent-permissions/SUMMARY.md) (not built). Tests 46/46; real runs with Codex and Claude Code as orchestrator. See [details](DETAILS.md).
