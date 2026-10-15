# Product acceptance scenarios

These are product-level tests; each becomes executable as its dependencies are implemented.

## G1 — Project-agnostic task

create a non-code personal project; attach notes; ask an AI to research/organize them; store source-backed result without requiring Git or Unity.

## G2 — Multi-user access

employee can query an authorized repo but cannot discover, retrieve or prompt-leak another private repo; revocation takes effect for new operations/resumed tasks.

## G3 — Concurrent autonomous work

foreground conversation with one model continues while two background tasks use two different models/tools. Close/reopen desktop and inspect both tasks and progress.

## G4 — Context rollover

force a long task to exceed a small test context budget, checkpoint and continue in a fresh context. Change model mid-task and recover after worker crash; preserve evidence and avoid repeating completed work.

## G5 — Safe tool trust

untrusted project requests an unapproved executable or MCP. It is blocked; admin reviews source/version/permissions; only approved trusted registry entry permits download, with integrity verification.

## G6 — Replace model

change role profile mapping from model A to model B; same task/skill works without source-code changes. Show provider trace and compare actual tests/costs.

## G7 — Knowledge grounding

ask a version-sensitive coding question; retrieve matching local project/SDK docs with provenance and permissions; use current web verification if docs are stale.

## G8 — Parallel Unity environment

human edits combat in Unity instance 1; AI in separate instance/worktree builds new environment scene with only approved assets, captures multiple render views without a dedicated visible monitor, saves scene and submits reviewable branch/screenshots. Human can request a revision and merge after approval.

## G9 — Shared Unity mode

AI can work on a designated separate scene in one Editor without editing prohibited scenes/assets; UI clearly warns about shared Editor-global state.

## G10 — Technology discovery

query massive catalog; planner searches mandatory and relevant extra sources, progressively filters metadata and fetches live docs only for finalists; reports evidence and license uncertainty without installing anything.

## G11 — Mobile handoff

dictate a boss mechanic on phone into an authorized project; start research; same task/result is available on desktop, queued for local-runner steps as needed.

## G12 — Creative modularity

use a named role/capability to produce concept → optional mesh/animation → Unity-ready artifact; replace provider without changing the skill. Human remains able to take over source files.

## G13 — Safe IP screening

batch fictional game identities/art; internal automated screen identifies specific similarity dimensions and escalates uncertain cases; never reports legal approval.
