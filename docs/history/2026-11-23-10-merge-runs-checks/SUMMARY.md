# request_merge runs the checks itself (agent-interface-008, merge batch)

request_merge no longer trusts the check results an agent reports: it refuses uncommitted work, then shows the approval card at once while `npm run typecheck` and `npm test` run in the worktree; the card shows their progress, Allow takes effect only once they pass, and a failure withdraws the card and goes back to the agent with the output. The `checks` parameter, most of the merge note's rules and part of the guard's merge refusal are gone. Tests 125/125; a real run of the checks on this worktree took 35 s.

[Details](DETAILS.md).
