# 2026-10-21: PR #61 cross-platform worktree path identity

Scope: repair the read-only `branches`/`status` actions under [selfdev-004](../../features/self-development/SPEC.md#requirements), preserving [ADR 0015](../../architecture/decisions/0015-write-guard.md) and [ADR 0017](../../architecture/decisions/0017-merge-through-workspace.md). This corrects the portability of the [original implementation](../2026-10-21-05-read-repo-branches-status/DETAILS.md), without expanding authorization to other repositories or subdirectories.

## Diagnosis and change

Inspected [run 39618830688](https://github.com/MomSesImSpcl/ai-workspace/actions/runs/39618830688), including complete failure sections for Windows job 119286503027 and macOS job 119286502781. Both ran 93 tests, with 92 passing and one failing at `repo-read.test.ts:47`: `status` rejected the supplied worktree at `repo-read.ts:76`. Windows supplied a path containing the short-name component `RUNNER~1`; macOS supplied its temporary worktree under `/var/folders`. Git resolves filesystem aliases (including macOS's `/var` to `/private/var`), while the old `resolve` plus lowercase comparison only normalized text. macOS was checked independently rather than inferred from Windows.

The workspace `read_repo` response was cut at 30,000 characters before the macOS error. Its GitHub CLI cached run archive supplied the full Windows and macOS test logs. Requested GitHub setup exposed no plugin tools; public job annotations provided no stack trace. No agent integration or credentials were changed.

[repo-read.ts](../../../app/src/repo-read.ts) now resolves the request and registered roots with filesystem `realpath`, compares exact canonical roots or their device/inode identities (nonzero inode required), skips unavailable registrations, and refuses nonexistent or foreign paths. Directory identity also recognizes case aliases on filesystems where canonical spelling retains caller case. No platform-wide lowercasing: distinct paths on case-sensitive volumes remain distinct. NUL-delimited worktree porcelain preserves Unicode and whitespace without Git's quoting. Status uses `--no-optional-locks` to prevent index refresh writes; commands still only read repository state.

[repo-read.test.ts](../../../app/test/repo-read.test.ts) adds real directory aliases (junctions on Windows, symlinks elsewhere), canonical paths, Unicode/spaces, parent/subdirectory/nonexistent and foreign-repository refusals, stale registrations, filesystem-dependent case identity, and Windows 8.3 aliases when available. It checks that index bytes, lock absence, refs and worktree registrations remain unchanged after reads. The original macOS temporary-directory scenario remains unchanged.

## Verification and handoff

- `npm.cmd run typecheck`: clean on Windows.
- Focused repository tests: 6 passed, 1 skipped (local volume has no generated 8.3 names), no failures; case-insensitive alias verified locally. Case-sensitive rejection and the macOS temporary-directory alias are exercised by CI on the appropriate filesystems.
- Full suite: 97 tests, 96 passed, 1 skipped (8.3 names unavailable), no failures, on Windows outside the sandbox.
- Required private-data scan from `.github/workflows/ci.yml`: clean. Staged files are rescanned before commit.
- Sandbox tests encountered unreadable global Git ignore-file warnings; focused checks passed after approved execution outside the sandbox. Product output and assertions were not weakened to hide those warnings.

Branch: `merge-conflict-test`, based on PR head `a4f0d78`; repair uncommitted at this record's creation. Commit `8b58751` (task `d9150799`, configured implementer) is preserved unchanged on local branch `preserve/d9150799-agent-selection`, outside this branch's ancestry and PR #61. No unrelated files from it are included. No new architecture or authorization decision was needed.

Next: commit the verified repair, update existing [PR #61](https://github.com/MomSesImSpcl/ai-workspace/pull/61) through `request_merge`, and inspect all required checks and merge outcome with `read_repo`. M1's in-app merge-conflict criterion remains separate.
