# Branch cleanup

So forgotten branches cannot fill the disk (user, 2026-10-19): merged branches of the app project without uncommitted changes or a running agent are removed at app start and once a day; chats of a removed branch are archived and read only (user's choice); unmerged work is never removed automatically. Settings → General lists every branch of the app project with its state, size, an Open button and a Remove… that names what would be lost. [ADR 0014](../../architecture/decisions/0014-worktree-per-session.md) amended; [details](DETAILS.md).
