# Write-guard rules in the worktree note

Worktree agents are now told the write guard's rules up front ([selfdev-002](../../features/self-development/SPEC.md#requirements)): keep the shell in the worktree, write files with edit tools instead of shell heredocs, keep merge commands out of command text. Aim: fewer block notices in the chat; the guard itself is unchanged. Typecheck and tests pass; not yet seen in the app with real agents.

[Details and verification](DETAILS.md).
