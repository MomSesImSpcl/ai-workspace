import { spawn } from 'node:child_process';
import { closeSync, existsSync, openSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { claudeSession } from './adapters/claude-code.ts';
import { codexSession } from './adapters/codex.ts';
import { acquireRunner, clearStop, emit, loadSession, markStarting, readEvents, releaseRunner, repeatsFor, saveSession, sessionFile, sessionRoot, stopRequested, transcript, turnPrompt, turns, used, type AgentProcess, type Body, type Session, type SessionAgent, type SessionEvent, type Usage } from './sessions.ts';
import { taskUsed } from './tasks.ts';

export const sessionAgents: Record<string, SessionAgent> = { 'claude-code': claudeSession, codex: codexSession };

export function sessionAgent(integration: string, agents = sessionAgents): SessionAgent {
  const agent = agents[integration];
  if (!agent) throw new Error(`Integration "${integration}" cannot run sessions`);
  return agent;
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

const pending = (id: string) => {
  const events = readEvents(id);
  const last = turns(events, true).at(-1);
  return last?.state === 'working' && !started(events, last.n);
};

// Runs the pending turn with an agent process and records how it ended. A task's Stop (cancel) and its
// token cap end the agent's process tree at once; the cap counts committed and streamed usage (runtime-005).
async function oneTurn(id: string, proc: AgentProcess): Promise<{ staleHint?: boolean }> {
  const ts = turns(readEvents(id), true);
  const cur = ts.at(-1)!;
  const say = (body: Body) => emit(id, cur.n, body);
  const session = loadSession(id);
  const task = session.task;
  const stop = new AbortController();
  let stopped: string | undefined;
  const halt = (reason?: string) => {
    if (stop.signal.aborted) return;
    stopped = reason;
    stop.abort(task ? 'kill' : 'interrupt');
  };
  const committed = task ? taskUsed(session) : 0;
  const live = task ? (u: Usage) => committed + used(u) >= task.tokenBudget && halt(`token budget ${task.tokenBudget.toLocaleString('en')} reached`) : undefined;
  const watch = setInterval(() => stopRequested(id) && halt(), 300);
  try {
    say({ type: 'start', integration: session.integration });
    live?.({ inputTokens: 0, outputTokens: 0 });
    if (stop.signal.aborted) {
      say({ type: 'stopped', reason: stopped });
      return {};
    }
    const r = await proc.turn({ prompt: turnPrompt(ts), history: transcript(ts.slice(0, -1)), emit: say, signal: stop.signal, live, repeats: task ? repeatsFor(ts) : undefined });
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
    clearStop(id);
  }
  return {};
}

// A process is started with its model, effort and permission mode; a change restarts it, resuming the conversation.
const outdated = (proc: AgentProcess, s: Session) => proc.effort !== s.effort || proc.model !== s.model || proc.permissionMode !== s.permissionMode;

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
      if (pending(id)) {
        const session = loadSession(id);
        if (proc && (running !== session.integration || outdated(proc, session))) {
          proc.close();
          proc = undefined;
        }
        try {
          running = session.integration;
          proc ??= sessionAgent(session.integration, agents).open(session, sessionRoot(session));
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
          proc = sessionAgent(s.integration, agents).open(s, sessionRoot(s));
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
