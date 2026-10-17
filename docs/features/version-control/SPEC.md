# Version control in the workspace

[Shared principles](../../PRINCIPLES.md) and [related features](SUMMARY.md) apply.

## Problem

Projects are local folders; collaboration and backup happen through the project's version control ([identity-projects 1.4](../identity-projects/SPEC.md#14-workspace-and-local-projects)). A user who joins a studio project clones it from GitHub (or checks it out from Perforce) and wants it in the workspace at once. Everyday operations such as looking at changes, committing and pushing should not require asking an agent or leaving the app for a terminal.

## Requirements

- **vcs-001 — Get a project from a remote:** The user MUST be able to add a project by cloning or checking out from a remote (URL or provider address) into a local folder they choose; the result is registered as a project. Adding an existing local working copy as a project MUST also detect its version control.
- **vcs-002 — Status and changes:** For a version-controlled project the UI MUST show the current branch (or stream/workspace for other systems), whether it is ahead or behind its remote, and the changed files with a per-file diff view. A project without version control shows that it has none, without errors.
- **vcs-003 — Commit:** The user MUST be able to select changed files, write a message and commit. The UI MUST NOT commit workspace state (sessions, tasks, audit) because it never lives in the project folder (identity-projects 1.4).
- **vcs-004 — Sync:** Pull (or the system's equivalent) and push from the UI, with the result and any error shown verbatim. A rejected push MUST explain that the remote has newer changes and offer pull first; the UI MUST NOT offer a force push.
- **vcs-005 — History:** A history view with commits (author, date, message) and the files and diff of a selected commit. Filtering history to one file MAY be offered.
- **vcs-006 — Branches:** List, switch and create branches. Switching with uncommitted changes MUST warn and MUST NOT discard them silently.
- **vcs-007 — Conflicts:** When a pull or switch produces conflicts, the UI MUST list the conflicted files and stop; it MUST NOT resolve them automatically. The user can resolve them in their editor or hand the conflict to an agent in a session.
- **vcs-008 — Safety:** Destructive operations (discarding changes, resetting, deleting branches) MUST require explicit confirmation naming what will be lost. Every operation the UI runs MUST be recorded in the workspace audit log.
- **vcs-009 — Credentials stay with the tools:** Authentication MUST use the version-control system's own credential mechanism (for example Git credential helpers, SSH keys, the Perforce login). The workspace MUST NOT ask for, store or display passwords or tokens.
- **vcs-010 — Provider seam:** Operations go through one provider interface per version-control system. Git is the first provider; the UI MUST show only the operations the active provider supports, so Perforce and others can be added without UI rewrites.
- **vcs-011 — Agents use the same path:** When an agent performs version-control actions, they MUST go through the tool broker with the session's or task's permissions and audit ([tool-broker](../tool-broker/SPEC.md)), not through an unscoped shell.

## Non-goals

Hosting repositories, code review and pull requests, merge tools, CI, managing remote permissions, and storing workspace data in version control.

## Open decisions

- **Second provider:** Perforce or another system, and when.
- **Large files:** how Git LFS or similar systems are shown and handled (relevant for game and media projects).
- **Agent commits:** whether agents may commit and push on their own, and how their commits are attributed (user, agent co-author).
- **Remote discovery:** browsing the user's GitHub or provider repositories to pick one to clone, versus pasting a URL only.

## Acceptance checks

- Cloning a GitHub repository by URL into a chosen folder adds it as a project with branch and clean status shown; the user's existing Git credentials were used and nothing was stored by the workspace.
- Editing two files shows both as changed with diffs; committing one leaves the other changed; the history shows the new commit.
- Push after someone else pushed is rejected with an explanation and a pull option; no force push is offered.
- Switching branches with uncommitted changes warns before anything changes.
- A pull with conflicts lists the conflicted files and changes nothing else.
- A plain folder without version control is a normal project and shows "no version control".
- Every operation above appears in the workspace audit log.
