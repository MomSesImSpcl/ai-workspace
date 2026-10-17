# Workspace folder

The workspace can now have one root folder (Settings → Workspace folder), decided with the user: still one workspace per computer, projects usually live inside it but may be elsewhere. The add-project picker starts there, and the "Workspace" breadcrumb shows it on hover and opens it. Spec: identity-projects 1.4. API `POST /api/workspace`, stored in `workspace.json` in workspace storage; test added (30/30). The Electron picker start folder was not checked in the desktop window. Branch `claude/chat-sessions-per-project-f82af3`.
