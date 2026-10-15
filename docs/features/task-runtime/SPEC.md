# Durable autonomous tasks and context continuation

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 4.1 Two top-level work modes

**Interactive session:** live, low-latency, interruptible conversation with a selected model/role, optionally tool-assisted.

**Delegated autonomous task:** independent persistent task started by a user or authorized parent task and operated by a worker over minutes, hours or multiple contexts.

- A conversation can create one or more delegated tasks. The conversation remains responsive and can continue using any model while background tasks run.
- Multiple independent tasks run concurrently subject to authorizations, resource capacity, API rate limits, approval gates and budgets.
- Each task owns its context, goals, instructions, assigned role/model profile, work items, evidence, artifacts, checkpoints and lifecycle. Tasks do not consume one another's context windows.
- A task may be foreground or background without changing its persistent identity.

## 4.2 Minimum task state

Store **durably**, not just in the chat transcript:

```text
Task:
  id, owner, project/repo authorization references,
  goal, acceptance criteria, constraints, priority,
  selected role/profile/model override, assigned runner,
  status, current stage, created/updated timestamps,
  budgets, work graph, open questions, user messages,
  checkpoints, artifacts, evidence refs, logs, failures,
  approvals, model/tool usage, result and review state
```

Keep structured machine state (e.g., processed entity IDs, API cursors, input hashes) distinct from semantic handoff (what has been learned, important caveats, what to do next). Use transaction-safe persistence and immutable task/event history where appropriate.

## 4.3 Context rollover and continuation

- Before an LLM call, assemble a context package based on the chosen model's actual limits, reserved output budget and tool overhead. Do not fill the context until it errors.
- When the next unit will exceed safe context capacity, checkpoint externally, finalize relevant results/evidence, start a **new model context**, rehydrate project/task instructions + concise semantic handoff + selected source references, and continue.
- Never rely solely on repeated prose summaries of summaries. Keep raw evidence, exact references, data tables and source snapshots retrievable. Reopen primary sources when uncertain.
- Context rollover must work across model providers and model changes, not only one vendor's proprietary thread IDs.
- On crashes/reboots, resume from the last committed task/work-item checkpoint; retry failed units with capped, idempotent retry behavior. A resumed task must not repeat unsafe external side effects.
- Support hierarchical Map/Reduce-like processing for huge research or code searches: independently process batches, store structured findings, synthesize, and permit source drill-down.

## 4.4 Task graph and child tasks

- Work is represented as dependency-aware nodes: `pending/running/completed/failed/blocked/skipped`; each may have retries, output schema, evidence and child tasks.
- A worker can propose or spawn bounded child tasks, e.g., environment creation requests a missing stained-glass asset. Child tasks inherit appropriate least-privilege access and budget ceilings.
- Parallel steps may run simultaneously; dependencies must be respected. A parent can do independent work while a child runs and can resume after its completion.
- Detect loops/repeated work using stable IDs for queries, entities, files, retrieved sources and workflow nodes. Bound automatic expansion by maximum depth, candidates, tool calls, runtime and cost.
- Support user-selectable execution depth such as Quick, Normal, Deep, Exhaustive, but these are budget/policy presets, not guarantees of completeness.

## 4.5 Live control, handoff and model switching

- A user can append instructions/reference files to a running task, which the worker applies at a safe checkpoint; urgent stop/cancel takes precedence.
- Pause/resume preserves state and allocated artifacts. Cancellation must propagate to workers/tools where supported and leave a recoverable audit/history.
- Permit model changes within a task **at a checkpoint**. The next model receives task state and context, not the prior model's hidden reasoning. Warn if capabilities differ.
- Permit reassignment to another authorized runner when input files, dependencies and security constraints permit it.
- Support human approvals at meaningful milestones and explicit review before merging code, publishing output, installing software or making other destructive/high-risk changes.

## 4.6 Scheduling and budgets

- Scheduler tracks worker health and capacity: CPU/RAM/GPU/VRAM/disk, loaded local models, available apps, currently active Unity/Blender sessions, API rate limits and concurrency ceilings.
- Provide priorities such as Interactive, High, Normal, Low, Idle. **Foreground user experience takes priority**; provide configurable machine reserve and throttle/pause background GPU/CPU-intensive jobs when needed.
- Track per-task and per-user/model/provider cost and usage, including input/output tokens, API calls, image/video/3D generation, time and estimated resource consumption. Enforce configurable spending and rate limits.
- Make costs/usage factual: do not present a guessed exact price or fabricated percent progress as verified. State estimates distinctly.

**Product acceptance:** G3, G4 in [acceptance scenarios](../../ACCEPTANCE.md).

## Acceptance evidence

- From a usable client, run an authorized project task using a real configured model and permissioned tool/runner action. Persist status, result and a traceable artifact/log; close/reopen the client and verify the result survives while interactive conversation still works.
- Demonstrate two tasks alongside foreground chat, explicit failure/blocked states, pause/resume/cancel and appended instructions. Restart a worker and recover its committed checkpoint without repeating a completed side effect.
- Force rollover with a deliberately small test context budget; rehydrate in a fresh context, batch a long research task and synthesize results with source links.
