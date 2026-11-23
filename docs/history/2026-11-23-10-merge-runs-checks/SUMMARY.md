# request_merge runs the checks itself (agent-interface-008, merge batch)

request_merge no longer trusts the check results an agent reports: before the approval card it refuses uncommitted work and runs `npm run typecheck` and `npm test` in the worktree; a failure goes back to the agent with the output and no card, and the card shows what the workspace ran. The `checks` parameter, most of the merge note's rules and part of the guard's merge refusal are gone. Tests 124/124; a real run of the checks on this worktree took 35 s.

[Details](DETAILS.md).
