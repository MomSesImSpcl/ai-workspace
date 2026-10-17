# The app reopens where it was closed

View state (project, open session per project, page, chat width, sidebar) moved from browser storage to workspace storage (`ui-prefs.json`, `GET/POST /api/prefs`), because the UI server picks a new port on every launch and browser storage is per origin. The desktop window also restores its size, position and maximized state (`window.json` in Electron's user data). Tests 33/33; restore across a server on another port checked in the browser pane; the window bounds not checked (desktop window only). Branch `claude/chat-sessions-per-project-f82af3`.
