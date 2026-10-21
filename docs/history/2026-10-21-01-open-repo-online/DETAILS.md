# 2026-10-21: open the repository online from the project menu

Scope: [identity-projects 1.4](../../features/identity-projects/SPEC.md#14-workspace-and-local-projects), requested by the user; the app's own project gets a menu with only this item (user's choice).

## Outcome

- `app/src/remote.ts`: `webOf` turns a git remote address (https, `git@host:path`, `ssh://`, Azure DevOps SSH) into a web page and site name, dropping any sign-in data; `projectWeb` reads `origin`, else the first remote. Local paths, `file://`, Perforce, SVN and folders without a remote give none.
- `app/src/ui.ts`: `/api/meta` adds `web` per project. `app/src/ui.html`: "Open in <site>" first in the project menu, opened in the browser through the desktop shell's link handler; the app's own project shows its menu only with a remote, with Archive and Remove hidden.

## Checks

- `npm run typecheck` clean, `npm test` 88/88; `app/test/remote.test.ts` covers every address form, token removal, local paths, and origin versus first remote.
- Real Electron on Linux (Xvfb): the app project's menu shows only "Open in GitHub" with the repository's address and opens it; a project without a remote shows Archive and Remove only.
