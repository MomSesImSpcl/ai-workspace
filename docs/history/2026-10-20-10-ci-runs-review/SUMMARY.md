# CI runs reviewed

The user asked why CI ran several times per pull request. No accidental duplicates: each run had its own event; the two runs on one commit are the draft (Ubuntu) and then `ready_for_review` (all systems), by design. The `main` run after #30 had failed on Windows from two tests timing out on a slow runner; their limits are raised. Agents now open finished pull requests as ready. [Details](DETAILS.md).
