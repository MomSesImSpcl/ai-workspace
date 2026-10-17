import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { addMessage, createSession, GLOBAL, listSessions, readEvents } from '../src/sessions.ts';
import { createTask, listTasks } from '../src/runtime.ts';
import { getProject, home, listProjects, registerProject, setWorkspaceRoot } from '../src/store.ts';
import { exportStorage, importStorage } from '../src/transfer.ts';

let base = '';
const useHome = (name: string) => (process.env.AI_WORKSPACE_HOME = join(base, name));
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'ws-transfer-'));
});
const claude = { integration: 'claude-code' };
const bundle = (file: string) => JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) as { files: Record<string, string> };

// Machine A: workspace folder with two projects (one folder will not exist on B), a global session, a task.
function machineA(): { file: string; sessionId: string } {
  useHome('a');
  const ws = join(base, 'A');
  for (const d of ['app', 'old']) mkdirSync(join(ws, d), { recursive: true });
  setWorkspaceRoot(ws);
  registerProject(join(ws, 'app'), 'app');
  registerProject(join(ws, 'old'), 'old');
  const s = createSession('app', 'Chat', claude);
  addMessage(s.id, 'hello from A');
  createSession(GLOBAL, 'Chat', claude);
  const t = createTask({ projectId: 'app', goal: 'g', role: 'Implementation', integration: 'claude-code', write: false, tokenBudget: 1000 });
  writeFileSync(join(home(), 'projects', 'app', 'tasks', `${t.id}.pid`), '123'); // runner file: must not travel
  mkdirSync(join(home(), 'codex'), { recursive: true });
  writeFileSync(join(home(), 'codex', 'auth.json'), '{"token":"secret"}'); // credentials: must not travel
  const file = join(base, 'export.aiworkspace');
  exportStorage(file);
  rmSync(join(ws, 'old'), { recursive: true }); // pretend 'old' does not exist on the other computer
  return { file, sessionId: s.id };
}

test('export then import into an empty workspace brings sessions, tasks and projects; credentials and runner files stay out', () => {
  const { file, sessionId } = machineA();
  const paths = Object.keys(bundle(file).files);
  assert.ok(!paths.some((p) => p.startsWith('codex/') || p.endsWith('.pid')));

  useHome('b');
  const wsB = join(base, 'B');
  mkdirSync(join(wsB, 'app'), { recursive: true });
  setWorkspaceRoot(wsB);
  // Machine A's folders are gone on B: rename A so its paths do not exist.
  rmSync(join(base, 'A'), { recursive: true });
  const r = importStorage(file);
  assert.equal(r.sessions, 2);
  assert.equal(r.tasks, 1);
  assert.deepEqual(r.projects.map((p) => [p.id, p.outcome]), [['app', 'found in workspace folder'], ['old', 'folder missing (archived)']]);
  assert.equal(getProject('app').root, join(wsB, 'app'));
  assert.equal(getProject('old').archived, true);
  assert.equal(readEvents(sessionId)[0].type, 'user');
  assert.equal(listSessions(GLOBAL).length, 1);
  assert.equal(listTasks().length, 1);
  assert.equal(existsSync(join(home(), 'codex')), false);

  // A second import adds nothing.
  const again = importStorage(file);
  assert.equal(again.sessions + again.tasks, 0);
  assert.ok(again.projects.every((p) => p.outcome === 'present'));
  assert.equal(listProjects().length, 2);
});

test('import rejects foreign files, unknown versions and paths outside storage without writing anything', () => {
  useHome('c');
  const write = (value: unknown) => {
    const f = join(base, `bad-${Math.random()}.aiworkspace`);
    writeFileSync(f, gzipSync(JSON.stringify(value)));
    return f;
  };
  const files = (extra: Record<string, string>) => ({ format: 'ai-workspace', version: 1, exportedAt: '', files: { 'projects/p/sessions/ok.json': 'e30=', ...extra } });
  writeFileSync(join(base, 'plain.txt'), 'nope');
  assert.throws(() => importStorage(join(base, 'plain.txt')), /not an AI Workspace export/);
  assert.throws(() => importStorage(write({ ...files({}), version: 99 })), /unsupported export format/);
  for (const evil of ['../evil.txt', 'projects/../../evil.txt', 'C:/evil.txt', 'codex/auth.json', 'settings.json'])
    assert.throws(() => importStorage(write(files({ [evil]: 'eA==' }))), /outside workspace storage/, evil);
  assert.equal(existsSync(join(home(), 'projects', 'p', 'sessions', 'ok.json')), false); // nothing written
});
