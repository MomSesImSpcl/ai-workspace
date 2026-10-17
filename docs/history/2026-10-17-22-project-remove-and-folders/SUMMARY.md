# Remove archived projects; add workspace folders

An archived project's menu now has "Remove from workspace…" (styled confirmation), which drops only the project's reference: the folder, sessions, tasks and logs stay, and re-adding the folder under the same name brings them back. The Projects page lists the workspace folder's subfolders that are not projects yet, each with an Add button. Spec: identity-projects 1.4. Tests 32/32; checked in the browser pane (added a listed folder; archived and removed a project; its folder stayed). Branch `claude/chat-sessions-per-project-f82af3`.

Files: `app/src/store.ts` (`removeProject` requires archived, `unaddedFolders`), `app/src/ui.ts` (`POST /api/projects/<id>/remove`, `unaddedFolders` in `/api/meta`), `app/src/ui.html`, test in `app/test/sessions.test.ts`.

Update (same day, user request): **Remove from workspace…** is also offered for active projects, without archiving first; the selected project falls back to another when it is removed.
