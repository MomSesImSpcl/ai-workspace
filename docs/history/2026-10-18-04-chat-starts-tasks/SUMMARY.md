# A chat starts tasks (sessions-002)

A chat's agent starts background tasks with the workspace `start_task` tool; the task records its chat, and the chat shows it inline with its approvals, reply field and result. The Task Center shows details and Cancel only; the stopgap start form, resume and reply there are removed ([ADR 0010](../../architecture/decisions/0010-tasks-started-from-chat.md)). Built, tested with fake agents, not yet run with the real agents; not merged. See [details](DETAILS.md).
