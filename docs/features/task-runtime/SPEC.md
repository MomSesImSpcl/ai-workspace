# Durable autonomous tasks and context continuation

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 4.1 Two top-level work modes

**Interactive session:** live, low-latency, interruptible conversation with a selected model/role, optionally tool-assisted.

**Delegated autonomous task:** independent persistent task started by the orchestrator, an agent in a session, not from another task ([ADR 0024](../../architecture/decisions/0024-no-delegate.md)) and not from a form in the Task Center ([ADR 0010](../../architecture/decisions/0010-tasks-started-from-chat.md)) and operated by a worker over minutes, hours or multiple contexts.

- A conversation can create one or more delegated tasks. The conversation remains responsive and can continue using any model while background tasks run.
- Multiple independent tasks run concurrently subject to authorizations, resource capacity, API rate limits, approval gates and budgets.
- Each task owns its context, goals, instructions, assigned role/model profile, work items, evidence, artifacts, checkpoints and lifecycle. Tasks do not consume one another's context windows.
- A task may be foreground or background without changing its persistent identity.

## 4.2 Minimum task state

For Hermes, the separate [evaluation and integration feature](../hermes-hindsight/SPEC.md) must establish run/session mappings and recovery fit. External agent state does not replace the durable task, checkpoint, budget and safe-retry contracts owned here.

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

## 4.7 Agent-native tasks

Decided in [ADR 0007](../../architecture/decisions/0007-tasks-agent-native.md); agent capabilities and fallbacks per [ADR 0006](../../architecture/decisions/0006-agent-capability-contract.md).

- **runtime-001 — Same agent setup as sessions:** (narrowed for tasks by [orchestrator-005](../ai-orchestrator/SPEC.md#independently-selectable-roles): a task loads only the items its role has always on plus those the orchestrator picks) A task MUST start the agent with its own tools, settings, plugins, hooks and MCP servers ([sessions-025](../sessions/SPEC.md#projects-agents-and-context)); the workspace adds only its own tools (`request_setup`, `read_repo`) and no write grant.
- **runtime-002 — Approvals wait:** When the agent's rules say "ask", the task MUST show an approval card and wait until the user answers, without a timeout; a waiting task MUST be visible as such in the task list.
- **runtime-003 — Permission mode:** A new task MUST default to the agent's own permission settings and MAY override them per task with the agent's own mode (for example Claude Code `acceptEdits` or `plan`); a mode that skips all checks MUST NOT be a default and MUST show a warning. Changed 2026-10-18 by the user: a task started from a chat uses the chat's task mode, `acceptEdits` unless the user picks another next to the chat box; an agent without that mode keeps its own settings. Workspace-wide settings are specified in [agent-permissions](../agent-permissions/SPEC.md).
- **runtime-004 — Repeat detection:** Every tool call MUST be recorded with a fingerprint (tool and input). When an interrupted step re-runs, a call matching one the interrupted attempt completed MUST be held before it runs and shown as an approval card naming the earlier step; the task waits for the user. Agents without a pre-run check MUST use the fallback: detect the repeat from events, stop the agent, pause and name the repeated step. Recovery context follows [sessions-021](../sessions/SPEC.md#permissions-events-and-recovery).
- **runtime-005 — Budget and cancel by process:** The token cap MUST be enforced from streamed usage by ending the agent's process tree and pausing the task; cancel MUST end the process tree immediately.
- **runtime-006 — Pause and resume (built 2026-10-18, [history](../../history/2026-10-18-06-orchestrator-slice-1/SUMMARY.md)):** Each task MUST offer **Pause** while it runs and **Resume** while paused, in its chat card and in the Task Center. Neither agent can freeze mid-step, so Pause interrupts the agent's turn (Claude Code interrupt, Codex `turn/interrupt`), keeping its conversation; the step in progress is cancelled, not killed with the process tree as cancel does. Resume continues the same agent conversation with a continue message; a call the paused attempt already ran is flagged as a possible repeat (runtime-004). A paused task keeps its usage and any cap.

## Acceptance evidence

- From a usable client, run an authorized project task using a real configured model and permissioned tool/runner action. Persist status, result and a traceable artifact/log; close/reopen the client and verify the result survives while interactive conversation still works.
- Demonstrate two tasks alongside foreground chat, explicit failure/blocked states, pause/resume/cancel and appended instructions. Restart a worker and recover its committed checkpoint; an exact repeat of a completed tool call is held for the user's decision (runtime-004) and other changes since the step started are listed.
- Force rollover with a deliberately small test context budget; rehydrate in a fresh context, batch a long research task and synthesize results with source links.
