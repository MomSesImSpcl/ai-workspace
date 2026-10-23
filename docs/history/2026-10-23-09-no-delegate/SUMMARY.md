# `delegate` removed: tasks do not start tasks

The workspace tool `delegate`, its instruction note, the Delegate setup item and the Subtask role are removed ([ADR 0024](../../architecture/decisions/0024-no-delegate.md)); the orchestrator or the user starts follow-up work as tasks of the chat. Old subtasks still show. Typecheck clean, tests 114/114; not yet tried in the app. Not committed.

[Details](DETAILS.md).
