import { spawn } from 'node:child_process';
import { closeSync, existsSync, openSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { claudeSession, ClaudeProcess } from './adapters/claude-code.ts';
import { codexSession } from './adapters/codex.ts';
import { acquireRunner, clearStop, emit, loadSession, markStarting, readEvents, releaseRunner, saveSession, sessionFile, sessionRoot, stopRequested, transcript, turnPrompt, turns, type Body, type SessionAgent, type SessionEvent } from './sessions.ts';

export const sessionAgents: Record<string, SessionAgent> = { 'claude-code': claudeSession, codex: codexSession };

export function sessionAgent(integration: string): SessionAgent {
  const agent = sessionAgents[integration];
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

type Run = (input: { prompt: string; history: string; emit: (b: Body) => void; signal: AbortSignal }) => Promise<{ vendorSessionId?: string; error?: string }>;

// Runs the pending turn with an agent and records how it ended.
async function oneTurn(id: string, run: Run): Promise<void> {
  const ts = turns(readEvents(id), true);
  const cur = ts.at(-1)!;
  const say = (body: Body) => emit(id, cur.n, body);
  const stop = new AbortController();
  const watch = setInterval(() => stopRequested(id) && stop.abort(), 300);
  try {
    say({ type: 'start', integration: loadSession(id).integration });
    const r = await run({ prompt: turnPrompt(ts), history: transcript(ts.slice(0, -1)), emit: say, signal: stop.signal });
    if (existsSync(sessionFile(id, '.json'))) {
      const s = loadSession(id); // the user may have renamed it meanwhile
      if (r.vendorSessionId) s.vendorSessionId = r.vendorSessionId;
      saveSession(s);
    }
    if (stop.signal.aborted) say({ type: 'stopped' });
    else if (r.error) say({ type: 'error', message: r.error });
    else say({ type: 'done' });
  } catch (e) {
    say({ type: 'error', message: (e as Error).message });
  } finally {
    clearInterval(watch);
    clearStop(id);
  }
}

// Runs the session's pending turn in its own agent process (agents without a long-lived mode, and tests).
export async function runTurn(id: string, agents: Record<string, SessionAgent> = sessionAgents): Promise<void> {
  if (!acquireRunner(id)) return;
  try {
    closeOrphanedTurn(id);
    if (!pending(id)) return;
    const session = loadSession(id);
    const agent = agents[session.integration];
    await oneTurn(id, (input) => {
      if (!agent) throw new Error(`Integration "${session.integration}" cannot run sessions`);
      return agent.turn({ session, root: sessionRoot(session), turn: turns(readEvents(id), true).at(-1)!.n, ...input });
    });
  } finally {
    releaseRunner(id);
  }
}

// Keeps one Claude Code process for the session and feeds it each new message, so plugins and hooks keep
// their state between turns (issue #15). Ends after idleMs() without a message, or when the session is deleted.
export async function hostSession(id: string): Promise<void> {
  if (!acquireRunner(id)) return;
  let proc: ClaudeProcess | undefined;
  try {
    closeOrphanedTurn(id);
    let idleSince = Date.now();
    while (existsSync(sessionFile(id, '.json'))) {
      if (pending(id)) {
        const session = loadSession(id);
        // --effort is fixed per process: a changed level restarts it, resuming the same conversation.
        if (proc && proc.effort !== session.effort) {
          proc.close();
          proc = undefined;
        }
        proc ??= new ClaudeProcess(session, sessionRoot(session));
        await oneTurn(id, async (input) => {
          const r = await proc!.turn(input);
          if (!r.staleHint) return r;
          // The agent's own session is gone: start fresh, with the conversation from workspace history.
          session.vendorSessionId = undefined;
          proc = new ClaudeProcess(session, sessionRoot(session));
          return proc.turn(input);
        });
        idleSince = Date.now();
        continue;
      }
      if (stopRequested(id)) clearStop(id); // Stop while idle: nothing to stop
      if (Date.now() - idleSince > idleMs()) break;
      await sleep(300);
    }
  } finally {
    proc?.close();
    releaseRunner(id);
  }
  // A message that arrived while this host was ending gets a new host.
  if (existsSync(sessionFile(id, '.json')) && pending(id)) startTurn(id);
}

// Claude Code sessions get a long-lived host; other agents run one process per turn.
export function runSession(id: string): Promise<void> {
  return loadSession(id).integration === 'claude-code' ? hostSession(id) : runTurn(id);
}

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
