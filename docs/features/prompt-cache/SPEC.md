# Prompt-cache awareness and cold-session cost control

[Shared principles](../../PRINCIPLES.md) and [related features](SUMMARY.md) apply.

## Problem

Providers cache the conversation prefix on their servers for a limited time (Anthropic: about 5 minutes by default, 1 hour with the extended lifetime; other providers differ). A message inside that window reads the cache at about a tenth of the input price. After it, the whole transcript is sent again at full input price and written to the cache again, whether the agent process stayed alive or the session was resumed. Keeping processes alive does not help; the cost depends on transcript length at the moment of a cache miss. Users do not see this, so a short reply after a break can cost more than the work before it.

## Requirements

- **cache-001 — Cache state per session:** The workspace MUST track, per session and task, the time of the last model call, the agent's cache lifetime (cache-005) and the size of the cached prefix from the last call's usage. From these it derives `warm`, `cooling` (inside the warning lead, cache-002) or `cold`, and shows the state and remaining time next to the session in the list and in the chat header. The state is an estimate and labelled so.
- **cache-002 — Warning before cold:** When a session with an unfinished conversation enters `cooling`, the app MUST show an unobtrusive warning in the session ("Cache goes cold in 1 min: the next message re-reads about 120k tokens"). The lead time is a user setting, default 1 minute. A desktop or mobile notification is sent only if the user turned it on ([notifications](../notifications/SPEC.md)). Warnings are suppressed for archived sessions and while a turn runs.
- **cache-003 — Ask before a cold send:** Sending to a `cold` session whose estimated cache-miss cost (cached prefix at full input weight plus the cache write, using [onboarding-009](../onboarding/SPEC.md#requirements) weights) exceeds a user threshold MUST first show the estimate and three choices: send anyway, compact first (if the agent supports it), or start a new session with a handoff (cache-004). The threshold is a setting; the user can turn the check off. Below the threshold the message is sent without asking.
- **cache-004 — Fresh session with handoff:** "Start fresh" MUST create a new session in the same project with the same agent, model and effort, seeded with a short handoff: the user's pending message, the conversation's goal and current state, and links to the files and tasks it touched. The handoff is shown to the user before sending. The old session stays available and links to the new one.
- **cache-005 — Cache lifetime per agent:** Setting up an agent MUST record its prompt-cache lifetime per model where known, with the source and date, alongside the token cost weights ([onboarding-009](../onboarding/SPEC.md#requirements)). Where the lifetime depends on the user's plan or a setting the workspace can read, it uses that value; otherwise it uses the documented default (5 minutes) and labels it an estimate. A miss observed in usage (a large cache write after a pause shorter than the recorded lifetime) MUST shorten the recorded value and say so.
- **cache-006 — Optional onboarding step:** Agent setup ([onboarding-002](../onboarding/SPEC.md#requirements)) MUST offer a skippable "Session costs" step that explains warm and cold sessions in two sentences, shows the lifetime per agent, and lets the user pick the warning lead (cache-002) and the cold-send threshold (cache-003), or turn both off. It is shown only for agents that report cache usage. Skipping keeps the defaults.
- **cache-007 — Orchestrator uses cache state:** When the orchestrator routes a follow-up ([orchestrator-006](../ai-orchestrator/SPEC.md)), it MUST prefer replying to a `warm` task and, for a `cold` task whose miss cost exceeds the threshold, start a fresh task with a handoff (cache-004) instead of resuming, unless the task's own context is required. The choice and its estimate are shown in the task card.
- **cache-008 — Agent's own cache guard:** If the agent already runs its own cold-cache guard (for example a hook that drops a prompt sent to a cold cache and reports it as an agent notice, [ADR 0008](../../architecture/decisions/0008-session-host-process.md)), the workspace MUST NOT ask a second time for the same send. It detects the guard from the agent setup inventory ([onboarding-010](../onboarding/SPEC.md#requirements)) and lets the guard's notice stand.

## Integration matrix

Relies on the existing rows "Live usage while running" (cache read and write tokens per call) and "Agent notices". Adds the row "Prompt-cache lifetime" (cache-005). Fallback for an agent that reports no cache usage: no cache state is shown and cache-002, 003 and 007 do nothing.

## Acceptance checks

- A session idle longer than the lifetime shows `cold`; one idle for less shows `warm` with the remaining time.
- With a 1-minute lead, the warning appears once, about 1 minute before the lifetime ends, and not while a turn runs.
- Sending to a cold session above the threshold shows the estimate and the three choices; "start fresh" opens a new linked session with the shown handoff; below the threshold nothing is asked.
- With an agent cache guard installed, a cold send shows only the guard's notice.
- Skipping the onboarding step leaves the defaults in place.

## Non-goals

Automatic background calls to keep caches warm, changing the provider's cache lifetime, and showing real prices (weights stay estimates, [onboarding-009](../onboarding/SPEC.md#requirements)).

## Open decisions

- Whether to offer an optional keep-warm ping (a minimal call that refreshes the cache at read cost) for long sessions the user marks as active; it spends tokens without a user message.
- Whether the warning lead and threshold are global or per project.
- Default cold-send threshold.
