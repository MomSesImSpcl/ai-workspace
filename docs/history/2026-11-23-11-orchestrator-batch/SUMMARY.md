# start_task enforces what the orchestrator note used to ask (agent-interface-008, orchestrator batch)

start_task now refuses another agent or model than the role's unless `override: true` says the user asked for it, requires a title and a reason, and refuses setup ids the agent does not list or the user switched off. The orchestrator note keeps only judgment (routing, goal size, caps, basedOn, setup choice, effort, asking back); list_agents and start_task lose their advice sentences. Two proposals stay text: whether the user asked for a cap, and whether an earlier task is related. Tests 125/125.

[Details](DETAILS.md).
