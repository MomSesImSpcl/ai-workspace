# Agent-native tasks and Codex app-server

Tasks are now background sessions with a token cap ([ADR 0009](../../architecture/decisions/0009-tasks-are-sessions.md)): runtime-001–005 of [task-runtime 4.7](../../features/task-runtime/SPEC.md#47-agent-native-tasks) built for Claude Code and Codex, and Codex sessions moved to `codex app-server` (#14). Tests 37/37 and real runs with both agents; uncommitted at the time of writing, see [details](DETAILS.md).
