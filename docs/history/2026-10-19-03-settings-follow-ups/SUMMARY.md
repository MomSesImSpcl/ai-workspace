# Settings follow-ups and UI style guide

After testing [history 02](../2026-10-19-02-settings-agents-tab/SUMMARY.md), the user asked for these changes (desktop-001):

- **Agent setup:**
  - The panel's width fits its agents, and the content keeps to the right.
  - Agent names, search and column titles stay at the top while the list scrolls.
  - Items are grouped and sorted A–Z, under small dim group titles. Descriptions are tooltips; skill and hook names stay visible.
  - A known file is shown selected in its folder (plugins, skills, hooks, MCP programs, the global rules file), through a new desktop call that never opens or runs files.
  - The global-rules switches are labelled "Use global rules".
- **Agents:**
  - "Saved" sits next to the role name and clears after 2 s; errors stay.
  - The Implementer (label for the `Implementation` role) has a Default permission. New tasks and the chat's mode picker start from it, Bypass asks first, and each mode's description is a tooltip.
  - Each role remembers its model, effort and permission per agent, so switching agents back restores them.
- **Composer:**
  - A new chat starts with the role's default effort; before, only agent and model were taken.
  - Changing a role's agent redraws its model list at once.
  - Chat is listed before Orchestrator.
  - Permissions sits next to Send.
  - The unused task-cap switch is removed. Tasks stay uncapped, and a cap is asked of the orchestrator in words (ADR 0011 note).
- **Permission modes:** "Accept edits" and Codex's "Auto" are now labelled "Edit project files", and Plan moves last. The stored ids are unchanged.
- **UI style guide:** [docs/UI_STYLE.md](../../UI_STYLE.md) (tokens, patterns agreed here, accessibility), read before interface changes (AGENTS.md step 5). Accent colours only through `--accent*` tokens.

Tests 50/50. Checked in the browser against the UI server; the user tested in the app and approved the merge. See [details](DETAILS.md).
