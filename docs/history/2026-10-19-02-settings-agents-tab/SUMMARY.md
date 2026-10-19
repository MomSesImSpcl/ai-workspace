# Settings: Agents tab and wide Agent setup

After testing the overlay ([history 01](../2026-10-19-01-settings-overlay/SUMMARY.md)), the user asked for these changes (desktop-001):
- Three roles in the order Chat, Orchestrator, Implementation. The planning role `ArchitectureReasoning` and the unbuilt `manual-browser` agent are dropped ([ADR 0013](../../architecture/decisions/0013-three-roles.md)), and the specs were updated.
- Each role picks its agent, default model and default effort from the agent's catalog.
- Each role has optional instructions: Chat for plain chats, Orchestrator for orchestrator chats, Implementation for tasks.
- The Agent setup tab widens up to the sessions column and shows one column per agent, each scrolling on its own.
- The tabs sit on the right.
- On first start from a source checkout, the workspace folder defaults to the repository.

Tests 49/49 (role order, unknown role and model refused, chat instructions saved); checked in the browser against the UI server. Not yet tested by the user. See [details](DETAILS.md).
