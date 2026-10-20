import { spawn } from 'node:child_process';
import { closeSync, existsSync, openSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { claudeSession } from './adapters/claude-code.ts';
import { codexSession } from './adapters/codex.ts';
import { acquireRunner, addMessage, clearStop, emit, queuedReplies, loadSession, markStarting, readEvents, releaseRunner, repeatsFor, saveSession, sessionFile, sessionRoot, stopRequested, transcript, turnPrompt, turns, used, type AgentProcess, type Body, type Session, type SessionAgent, type SessionEvent, type Usage } from './sessions.ts';
import { startPendingTasks, taskUsed } from './tasks.ts';
import { addWorktree, appRepo, checkoutChanges, checkoutSnapshot, installDependencies } from './worktrees.ts';

/**
 * The folder a session's agent runs in (selfdev-001): its worktree, made at the first turn with a notice in the
 * chat, else the project folder (`sessionRoot`). A worktree that is gone after that (the agent cleaned it up
 * after merging, or the user removed it) throws, so the turn shows the error instead of the agent silently
 * working in the live checkout. A new worktree gets its dependencies installed before the agent starts (#26).
 */
async function workRoot(s: Session): Promise<string> {
  const wt = s.worktree;
  if (!wt) return sessionRoot(s);
  if (wt.ready) {
    if (!existsSync(wt.path)) throw new Error(`This session's worktree is gone (${wt.path}, branch ${wt.branch}). Start a new session to keep working.`);
    return wt.path;
  }
  const from = addWorktree(sessionRoot({ projectId: s.projectId }), wt);
  saveSession({ ...loadSession(s.id), worktree: { ...wt, ready: true } });
  const n = turns(readEvents(s.id), true).at(-1)?.n ?? 0;
  emit(s.id, n, { type: 'notice', text: `Working in a new worktree on branch ${wt.branch}, from ${from}: ${wt.path}` });
  await installDependencies(wt.path, (text) => emit(s.id, n, { type: 'notice', text }));
  return wt.path;
}

export const sessionAgents: Record<string, SessionAgent> = { 'claude-code': claudeSession, codex: codexSession };

export function sessionAgent(integration: string, agents = sessionAgents): SessionAgent {
  const agent = agents[integration];
  if (!agent) throw new Error(`Integration "${integration}" cannot run sessions`);
  return agent;
}

// Agent, model and effort, checked against what the agent offers (its catalog). '' or null for model or
// effort means the agent's own default.
export function agentChoice(b: Record<string, unknown>, current: { integration: string; model?: string; effort?: string }) {
  const integration = b.integration === undefined ? current.integration : b.integration;
  if (typeof integration !== 'string' || !sessionAgents[integration]) throw new Error(`Unknown agent: must be one of ${Object.keys(sessionAgents).join(', ')}`);
  const catalog = sessionAgents[integration]!.catalog();
  const pick = (v: unknown, keep: string | undefined) => (v === undefined ? keep : v === null || v === '' ? undefined : v);
  const model = pick(b.model, integration === current.integration ? current.model : undefined);
  const entry = catalog.models.find((m) => m.id === (model ?? ''));
  if (model !== undefined && (typeof model !== 'string' || !entry)) throw new Error(`Unknown model: must be one of ${catalog.models.map((m) => m.id || 'default').join(', ')}`);
  let effort = pick(b.effort, current.effort);
  if (effort !== undefined && !(entry ?? catalog.models[0])?.efforts.includes(effort as string)) {
    if (b.effort !== undefined) throw new Error(`Unknown effort: must be one of ${(entry ?? catalog.models[0])?.efforts.join(', ')}`);
    effort = undefined; // a kept level the new agent or model does not offer falls back to its default
  }
  return { integration, model: model as string | undefined, effort: effort as string | undefined };
}

// How long a session host keeps its agent process after the last turn.
const idleMs = () => Number(process.env.AI_WORKSPACE_SESSION_IDLE_MS ?? 30 * 60_000);

const started = (events: SessionEvent[], n: number) => events.some((e) => e.turn === n && e.type === 'start');

// A turn that a dead runner started but never ended is recorded as interrupted, so it is not run twice.
function closeOrphanedTurn(id: string): void {
  const events = readEvents(id);
  const last = turns(events, true).at(-1);
  if (last?.state === 'working' && started(events, last.n)) {
    const done = last.activity.filter((a) => a.done);
    emit(id, last.n, { type: 'interrupted', step: done.length, label: done.at(-1)?.label });
  }
}

export const pending = (id: string) => {
  const events = readEvents(id);
  const last = turns(events, true).at(-1);
  return last?.state === 'working' && !started(events, last.n);
};

// Runs the pending turn with an agent process and records how it ended. A task's cancel and its token cap
// end the agent's process tree at once; the cap counts committed and streamed usage (runtime-005). Pausing
// a task interrupts the turn like a chat's Stop, so the agent keeps its conversation (runtime-006).
async function oneTurn(id: string, proc: AgentProcess): Promise<{ staleHint?: boolean }> {
  const ts = turns(readEvents(id), true);
  const cur = ts.at(-1)!;
  const say = (body: Body) => emit(id, cur.n, body);
  const session = loadSession(id);
  const task = session.task;
  const stop = new AbortController();
  let stopped: string | undefined;
  const halt = (kill: boolean, reason?: string) => {
    if (stop.signal.aborted) return;
    stopped = reason;
    stop.abort(kill ? 'kill' : 'interrupt');
  };
  const committed = task ? taskUsed(session) : 0;
  const budget = task?.tokenBudget;
  // Streamed usage: checked against the cap at once, and recorded every 2 s so the page shows tokens while it works.
  let shownAt = 0;
  const live = (u: Usage) => {
    if (Date.now() - shownAt > 2000) { shownAt = Date.now(); say({ type: 'live-usage', usage: u }); }
    if (budget !== undefined && committed + used(u) >= budget) halt(true, `token budget ${budget.toLocaleString('en')} reached`);
  };
  const watch = setInterval(() => {
    if (stopRequested(id)) halt(!!task && !!loadSession(id).task?.cancelled, task && !loadSession(id).task?.cancelled ? 'paused' : undefined);
    if (!task) startPendingTasks(id); // tasks its agent started with start_task
  }, 300);
  try {
    say({ type: 'start', integration: session.integration });
    live({ inputTokens: 0, outputTokens: 0 });
    if (stop.signal.aborted) {
      say({ type: 'stopped', reason: stopped });
      return {};
    }
    // An app-project turn must leave the running app's checkout alone (selfdev-002); the guard cannot see paths
    // computed at run time, so the checkout is compared before and after (#18).
    const checkout = session.worktree ? appRepo() : undefined;
    const before = checkout ? checkoutSnapshot(checkout) : undefined;
    const r = await proc.turn({ prompt: turnPrompt(ts), history: transcript(ts.slice(0, -1)), emit: say, signal: stop.signal, live, repeats: task ? repeatsFor(ts) : undefined });
    const after = checkout && before ? checkoutSnapshot(checkout) : undefined;
    const changed = before && after ? checkoutChanges(before, after) : [];
    if (changed.length) say({ type: 'notice', text: `⚠ Files in the running app's checkout changed during this turn: ${changed.slice(0, 10).join(', ')}${changed.length > 10 ? ` and ${changed.length - 10} more` : ''}. Agents work in their own worktree; if the agent made these changes, undo them in ${checkout} (git checkout or git clean).` });
    if (r.staleHint) return r;
    if (existsSync(sessionFile(id, '.json'))) {
      const s = loadSession(id); // the user may have renamed it meanwhile
      if (r.vendorSessionId) s.vendorSessionId = r.vendorSessionId;
      saveSession(s);
    }
    if (r.stopped) say({ type: 'stopped', reason: r.stopped });
    else if (stop.signal.aborted) say({ type: 'stopped', reason: stopped });
    else if (r.error) say({ type: 'error', message: r.error });
    else say({ type: 'done' });
  } catch (e) {
    say({ type: 'error', message: (e as Error).message });
  } finally {
    clearInterval(watch);
    if (!task) startPendingTasks(id);
    clearStop(id);
  }
  return {};
}

// Replies queued while the task worked become its next message once the turn has ended; a paused task
// keeps them for Resume.
function sendQueued(id: string): void {
  const events = readEvents(id);
  const state = turns(events, true).at(-1)?.state;
  const s = loadSession(id);
  if ((state === 'done' || state === 'error') && queuedReplies(events).length && s.task && !s.task.cancelled) addMessage(id, '');
}

// A process is started with its model, effort and permission mode; a change restarts it, resuming the conversation.
const outdated = (proc: AgentProcess, s: Session) => proc.effort !== s.effort || proc.model !== s.model || proc.permissionMode !== s.permissionMode || proc.setup !== s.task?.setup?.join(',');

// Items a task asked for with request_setup: its next message continues it with them, in a new process.
function continueWithSetup(id: string): void {
  const s = loadSession(id);
  const added = s.task?.setupAdded;
  if (!added?.length || s.task!.cancelled || !['done', 'error'].includes(turns(readEvents(id), true).at(-1)?.state ?? '')) return;
  s.task!.setupAdded = undefined;
  saveSession(s);
  addMessage(id, `The workspace enabled ${added.join(', ')}. Continue the task.`);
}

// Keeps one agent process for the session and feeds it each new message, so plugins and hooks keep their
// state between turns (issue #15). Ends after idleMs() without a message (at once with `once`), or when
// the session is deleted. An agent switch starts the new agent's process.
export async function hostSession(id: string, agents: Record<string, SessionAgent> = sessionAgents, once = false): Promise<void> {
  if (!acquireRunner(id)) return;
  let proc: AgentProcess | undefined;
  let running: string | undefined; // the integration `proc` belongs to
  try {
    closeOrphanedTurn(id);
    let idleSince = Date.now();
    while (existsSync(sessionFile(id, '.json'))) {
      continueWithSetup(id);
      sendQueued(id);
      if (pending(id)) {
        const session = loadSession(id);
        if (proc && (running !== session.integration || outdated(proc, session))) {
          proc.close();
          proc = undefined;
        }
        try {
          running = session.integration;
          const root = await workRoot(session); // every turn, so a removed worktree stops the session here
          proc ??= sessionAgent(session.integration, agents).open(session, root);
        } catch (e) {
          emit(id, turns(readEvents(id), true).at(-1)!.n, { type: 'error', message: (e as Error).message });
          continue;
        }
        if ((await oneTurn(id, proc)).staleHint) {
          // The agent's own conversation is gone: start fresh, with the conversation from workspace history.
          proc.close();
          const s = loadSession(id);
          s.vendorSessionId = undefined;
          saveSession(s);
          proc = sessionAgent(s.integration, agents).open(s, await workRoot(s));
          await oneTurn(id, proc);
        }
        idleSince = Date.now();
        if (once) break;
        continue;
      }
      if (stopRequested(id)) clearStop(id); // Stop while idle: nothing to stop
      if (once || Date.now() - idleSince > idleMs()) break;
      await sleep(300);
    }
  } finally {
    proc?.close();
    releaseRunner(id);
  }
  // A message that arrived while this host was ending gets a new host.
  if (!once && existsSync(sessionFile(id, '.json')) && pending(id)) startTurn(id);
}

// Runs the session's pending turn and ends (the CLI, tests).
export const runTurn = (id: string, agents: Record<string, SessionAgent> = sessionAgents) => hostSession(id, agents, true);

const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));

// Detached, so closing the window lets the reply finish and be saved (sessions-011). A running host
// picks a new message up itself; a second runner would exit at once because the first holds the lock.
export function startTurn(id: string): void {
  markStarting(id);
  const log = openSync(sessionFile(id, '.log'), 'a');
  const child = spawn(process.execPath, [cli, 'turn', id], { detached: true, stdio: ['ignore', log, log], windowsHide: true });
  closeSync(log);
  child.unref();
}
