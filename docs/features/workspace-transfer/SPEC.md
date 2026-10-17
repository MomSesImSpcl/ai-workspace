# Workspace backup, transfer and private sync

[Shared principles](../../PRINCIPLES.md) apply. [Related features](SUMMARY.md). Storage layout: [identity-projects 1.4](../identity-projects/SPEC.md#14-workspace-and-local-projects).

## Problem

Workspace storage lives on one computer by design, so private chats are never committed by accident. Users still need to back it up and to continue on another computer.

## Part 1 — Export and import

- **transfer-001 — Export:** Settings MUST offer **Export…**, which writes one file with the workspace's sessions, tasks, logs, project list and roles, and the workspace folder as a hint. Before saving it MUST say that the file contains private conversations.
- **transfer-002 — Never exported:** credentials and sign-ins (for example the dedicated Codex home), files that only make sense while something runs (runner pids, stop and cancel markers, live usage), and this computer's view and window state.
- **transfer-003 — Import merges:** **Import…** MUST merge by id: items that already exist are kept unchanged, so importing the same file twice adds nothing. Local settings (roles, workspace folder) are not overwritten, and the audit log stays this computer's own (the exported copy is for backup). Imported files land in the [per-project layout](../identity-projects/SPEC.md#14-workspace-and-local-projects).
- **transfer-004 — Project folders on the new computer:** for each imported project not yet in the workspace, the import MUST use, in order: the original folder if it exists here; else a folder with the same name in this workspace's folder; else add it archived with a note that its folder is missing. Adding the folder later under the same name links it (identity-projects 1.4). The result MUST list what happened to each project.
- **transfer-005 — Safe import:** the import MUST reject files of an unknown format version and any entry that would write outside workspace storage (absolute paths, `..`, unexpected top-level names); a rejected file changes nothing.
- **transfer-006 — Format:** a single gzip-compressed JSON file (`.aiworkspace`) with a format version and the files by storage path, built with the standard library only; a later move to a zip archive MAY be made with a version bump.

## Part 2 — Private sync (later, opt-in; not started)

Changes the identity-projects 1.4 rule that the workspace is never synced online; requires an ADR approved by the user before building.

- **transfer-101 — Opt-in only:** sync is off by default and enabled per workspace with a repository the user owns and keeps private.
- **transfer-102 — Encrypted at rest remotely:** content MUST be encrypted before it leaves the computer, with a key that stays on the user's computers (for example `age` or `git-crypt`); the remote never sees plain text.
- **transfer-103 — Same exclusions as export** (transfer-002).
- **transfer-104 — Merge-friendly:** event logs are append-only, so concurrent additions merge; a session MUST be written by one computer at a time (a lease visible in the session), and a conflict MUST be shown, never silently resolved.
- **transfer-105 — Visible state:** Settings shows the last sync, pending changes and errors; sync never blocks local work.

## Non-goals

Sharing a workspace with other users, cloud execution, syncing project content (that is the project's own version control).

## Open decisions

- Part 2: encryption tool, key handling across computers, and whether sync runs on a schedule or on demand.
- Part 1: exporting only selected projects (MAY be added).

## Acceptance checks

- Export on one workspace, import into an empty one: projects, sessions (with history) and tasks appear; credentials and runner files are absent from the file.
- Importing the same file again changes nothing.
- A project whose folder exists under the new workspace folder is linked there; one without a folder is added archived with a note.
- A file with an entry `../evil.txt` or an unknown version is rejected and nothing is written.
