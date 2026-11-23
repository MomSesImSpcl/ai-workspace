# The workspace ends a task's turn after request_setup (agent-interface-008, first batch)

A task that calls request_setup used to be told "End your turn now"; the workspace now ends that turn itself the moment the agent's event stream reports the call finished (no polling), records it as done rather than stopped, and continues the task with the items in a new process as before. The tool description and its reply no longer ask the agent to stop. Typecheck clean, tests 123/123; not yet tried with real agents.

[Details](DETAILS.md).
