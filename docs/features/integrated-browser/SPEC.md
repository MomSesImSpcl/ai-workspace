# Optional browser and web-based AI interfaces

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## Integrated Browser and Web-Based AI Interfaces

The workspace SHOULD provide an optional, modular Chromium-based browser integrated into the desktop application.

The browser MUST support ordinary interactive browsing, including access to web-based AI chat services using the user's existing accounts and subscriptions, subject to provider compatibility and terms.

Requirements:
1. Support multiple browser tabs, split views, and detachable windows.
2. Provide persistent, isolated browser profiles and secure session management.
3. Allow browser tabs to be associated with projects without automatically exposing project data to websites.
4. Support manual use of web-based AI services for planning, research, brainstorming, and reviewing work.
5. Allow the configured orchestrator to prepare structured prompts and context packages that users can inspect and manually transfer into browser chats, whether the orchestrator is local or hosted.
6. Support user-controlled transfer of browser responses into project notes, task context, or proposed memories.
7. Do not automatically trust imported browser content; preserve provenance and require validation where appropriate.
8. Keep browser-based AI interactions separate from API-based model integrations.
9. Automated browser interactions MUST comply with the relevant provider's terms and use supported integration mechanisms where available.
10. Provide an external-browser fallback for incompatible websites or authentication flows.
11. Run remote websites in isolated browser processes without unrestricted access to local files, workspace tools, or credentials.
12. Keep the browser module replaceable and optional; the rest of the workspace MUST function without it.

## Planning-role handoff

**browser-001:** Users MUST be able to use a compatible browser-based AI service as their selected planning/design layer independently of the selected orchestrator and coding agent. Users MUST be able to inspect the outgoing context and choose which planning response to import as a versioned plan for the current task, retaining source/session references where available and marking it as externally supplied content. Importing a response MUST NOT itself authorize execution; the configured orchestrator checks the task's acceptance criteria and deterministic workspace controls enforce permissions before delegation. Preserve a pending handoff when the session expires or transfer is interrupted. Use the existing manual transfer path unless a supported, authorized automated integration is explicitly configured.

Acceptance criteria: A user can open a supported AI chat website inside the workspace, sign in, conduct a planning conversation using their existing subscription, and manually bring useful results back into the current project without consuming the workspace's API quota.

For browser-001, use one browser planner with a separately selected compatible orchestrator and coding agent; inspect the exported context, import a chosen plan and verify its provenance/version in task state before delegation. Expire the browser session before transfer and verify that the pending handoff survives without exposing credentials or claiming the transfer completed. Confirm that the optional browser remains unnecessary for an all-adapter workflow.
