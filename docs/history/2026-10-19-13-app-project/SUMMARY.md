# The app project

The user asked (2026-10-19) to drop the per-project worktree switch: started from a git checkout, the app now adds that repository as a project at every start (unless a project already has its folder), lists it first with a line below it, labels it "this app" and offers no Remove. Only its sessions work in worktrees; other projects never do, and a packaged release has no app project. selfdev-007 is deferred. [ADR 0014](../../architecture/decisions/0014-worktree-per-session.md) amended; [details](DETAILS.md).
