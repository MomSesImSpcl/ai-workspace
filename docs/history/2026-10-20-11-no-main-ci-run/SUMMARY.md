# No CI run on `main` after a merge

The user found the second CI run on `main` after each merge redundant and noisy. The user turned on "Require branches to be up to date before merging" in the ruleset, so the squash commit equals the tested code; CI no longer runs on pushes to `main`, and `request_merge` merges `main` into the branch before it pushes. [Details](DETAILS.md).
