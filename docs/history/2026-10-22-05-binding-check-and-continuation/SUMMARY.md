# Binding check before work and publication, and explicit continuation (#62)

Fix for [#62](https://github.com/MomSesImSpcl/ai-workspace/issues/62) ([selfdev-008](../../features/self-development/SPEC.md#requirements), [ADR 0019](../../architecture/decisions/0019-binding-check-and-continuation.md)). Every worktree turn and every `request_merge` (before the card and after Allow) checks the session's stored worktree and branch against git. A merged pull request, another branch or a detached HEAD, a missing worktree or branch, or a foreign folder or project stops the work and explains why. A chat in that state continues only in a new chat the user confirms, while the old binding and its work stay as they are. Typecheck clean, tests 105/105 on Windows. Not yet verified in the app with real agents and a real pull request, so #62 and the M1 gate stay open.

[Details and verification](DETAILS.md).
