# One registry for every instruction (agent-interface-007)

Every text the workspace sends an agent (39 entries: role notes, message text, tool and parameter descriptions, tool replies and refusals) is now defined only in `app/src/registry.ts` and sent with `agentText` or `toolParam`. The Agent instructions tab is built from the registry and shows where each entry is sent from. Tests fail on a copy of an instruction anywhere else, on an entry never sent, and on a tool description not from the registry. Agents receive the same text as before. Typecheck clean, tests 120/120, browser-checked.

[Details](DETAILS.md).
