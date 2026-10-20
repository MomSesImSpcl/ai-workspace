# Details

- Before: the ruleset required only the Windows and macOS tests, so a failing Ubuntu run or private-data scan could merge.
- Checkout: `fetch-depth: 2`. Pull requests compare `HEAD^1` (the base side of GitHub's merge commit); pushes to `main` compare `github.event.before`, present for a squash merge. A missing base fails `git cat-file`, so all tests run.
- Rejected: a separate job for docs-only detection shared by the runners; the check costs about a second per runner, a job adds queue time.
- Verification: see the pull request's checks (draft on Ubuntu, then ready on all systems) and a docs-only pull request merging with auto-merge.
