import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addMessage, createSession, emit, readEvents, requestStop, sessionWorking, turnRunning, turns } from '../src/sessions.ts';
import { hostSession } from '../src/turn.ts';
import { registerProject } from '../src/store.ts';

const claude = { integration: 'claude-code' };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(check: () => boolean, ms = 8000): Promise<void> {
  for (const end = Date.now() + ms; Date.now() < end; await wait(50)) if (check()) return;
  throw new Error('timed out');
}
const last = (id: string) => turns(readEvents(id), turnRunning(id)).at(-1)!;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'ws-host-'));
  process.env.AI_WORKSPACE_HOME = join(dir, 'home');
  process.env.CLAUDE_BIN = fileURLToPath(new URL('./fake-claude.mjs', import.meta.url));
  process.env.AI_WORKSPACE_SESSION_IDLE_MS = '600';
  mkdirSync(join(dir, 'project'));
  registerProject(join(dir, 'project'), 'P');
});

test('one agent process answers every turn of a session, then the host ends when idle', async () => {
  const s = createSession('P', 'Chat', claude);
  addMessage(s.id, 'first');
  const host = hostSession(s.id);
  await until(() => last(s.id).state === 'done');
  const first = last(s.id).text;
  assert.match(first, /^turn 1 pid \d+$/);
  assert.equal(turnRunning(s.id), true); // idle host still alive
  assert.equal(sessionWorking(s.id), false);
  addMessage(s.id, 'second');
  await until(() => last(s.id).n === 2 && last(s.id).state === 'done');
  // Same process: its in-memory counter went on, and the pid is the same.
  assert.equal(last(s.id).text, first.replace('turn 1', 'turn 2'));
  await host; // idle timeout
  assert.equal(turnRunning(s.id), false);
});

test('Stop interrupts the turn in the running process, which then takes the next message', async () => {
  const s = createSession('P', 'Chat', claude);
  addMessage(s.id, 'slow please');
  const host = hostSession(s.id);
  await until(() => sessionWorking(s.id) && readEvents(s.id).some((e) => e.type === 'init'));
  requestStop(s.id);
  await until(() => last(s.id).state === 'stopped');
  addMessage(s.id, 'again');
  await until(() => last(s.id).n === 2 && last(s.id).state === 'done');
  assert.match(last(s.id).text, /^turn 2 /); // same process: second turn it has seen
  await host;
});

test('a turn left unfinished by a dead runner is marked interrupted and not run again', async () => {
  const s = createSession('P', 'Chat', claude);
  addMessage(s.id, 'work');
  emit(s.id, 1, { type: 'start', integration: 'claude-code' });
  emit(s.id, 1, { type: 'activity', id: 'a', label: 'Reading `x`' });
  emit(s.id, 1, { type: 'activity-done', id: 'a' });
  await hostSession(s.id);
  const t = last(s.id);
  assert.equal(t.state, 'interrupted');
  assert.equal(t.marker, 'Interrupted after step 1: Reading `x`');
  assert.equal(readEvents(s.id).filter((e) => e.type === 'start').length, 1);
});
