# start_task enforces what the orchestrator note used to ask (agent-interface-008, orchestrator batch)

start_task no longer lets the orchestrator choose the agent (user, [ADR 0026](../../architecture/decisions/0026-orchestrator-does-not-choose-implementer.md)): every task runs on the Implementation agent from Settings, on a model the orchestrator picks from that agent's catalog. It requires a title and a reason, and refuses setup ids the agent does not list or the user switched off. The orchestrator note keeps only judgment (routing, goal size, caps, basedOn, setup choice, effort, asking back); list_agents and start_task lose their advice sentences. Two proposals stay text: whether the user asked for a cap, and whether an earlier task is related. Tests 125/125.

[Details](DETAILS.md).
