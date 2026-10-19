# Settings follow-ups: verification

- `npm test`: 50/50. New and changed tests:
  - `commandFile` finds an absolute program path, also with spaces or quotes, and nothing for `npx` or a URL.
  - A role's last choices for an agent come back on `restore`.
  - An unknown `permissionMode` is refused, and `manual` is stored.
- Browser pane, UI server with a throwaway `AI_WORKSPACE_HOME`:
  - Two agents at 2000 px give a 1186 px panel without sideways scroll.
  - The column titles stay under the head after scrolling.
  - Searching "cave" keeps the groups.
  - 43 folder buttons, and a click passes the path. `window.desktop` was stubbed, so Electron's `showItemInFolder` itself ran only in the user's app test.
  - The Implementer set to claude-code with Sonnet, High and Manual was restored after a switch to codex and back.
  - Saved notes clear after 2 s.
  - The Permissions label and the Send button share one row, centred at the same y.
  - Orchestrator set to Sonnet/High preselected Sonnet/High in a new chat.
- The page script was checked to parse after each edit, after one edit broke it with a literal newline.
