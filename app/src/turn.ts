import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeSession } from './adapters/claude-code.ts';
import { codexSession } from './adapters/codex.ts';
import { clearTurnRunner, emit, loadSession, markTurnRunner, readEvents, saveSession, stopRequested, transcript, turnPrompt, turns, type SessionAgent } from './sessions.ts';
import { getProject, home } from './store.ts';

export const sessionAgents: Record<string, SessionAgent> = { 'claude-code': claudeSession, codex: codexSession };

export function sessionAgent(integration: string): SessionAgent {
  const agent = sessionAgents[integration];
  if (!agent) throw new Error(`Integration "${integration}" cannot run sessions`);
  return agent;
}

// Runs the session's last turn to its end and records how it ended. One agent process per turn.
export async function runTurn(id: string, agents: Record<string, SessionAgent> = sessionAgents): Promise<void> {
  markTurnRunner(id, process.pid);
  const session = loadSession(id);
  const ts = turns(readEvents(id), true);
  const cur = ts.at(-1);
  if (!cur || cur.state !== 'working') return clearTurnRunner(id);
  const say = (body: Parameters<typeof emit>[2]) => emit(id, cur.n, body);
  const stop = new AbortController();
  const watch = setInterval(() => stopRequested(id) && stop.abort(), 300);
  try {
    say({ type: 'start', integration: session.integration });
    const agent = agents[session.integration];
    if (!agent) throw new Error(`Integration "${session.integration}" cannot run sessions`);
    const r = await agent.turn({ session, root: getProject(session.projectId).root, turn: cur.n, prompt: turnPrompt(ts), history: transcript(ts.slice(0, -1)), emit: say, signal: stop.signal });
    const s = loadSession(id); // the user may have renamed it meanwhile
    if (r.vendorSessionId) s.vendorSessionId = r.vendorSessionId;
    saveSession(s);
    if (stop.signal.aborted) say({ type: 'stopped' });
    else if (r.error) say({ type: 'error', message: r.error });
    else say({ type: 'done' });
  } catch (e) {
    say({ type: 'error', message: (e as Error).message });
  } finally {
    clearInterval(watch);
    clearTurnRunner(id);
  }
}

const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));

// Detached, so closing the window lets the reply finish and be saved (sessions-011).
export function startTurn(id: string): void {
  const log = openSync(join(home(), 'sessions', `${id}.log`), 'a');
  const child = spawn(process.execPath, [cli, 'turn', id], { detached: true, stdio: ['ignore', log, log], windowsHide: true });
  closeSync(log);
  if (child.pid) markTurnRunner(id, child.pid);
  child.unref();
}
