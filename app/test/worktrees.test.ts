// Worktree per session (selfdev-001): planned at creation, made at the first turn, shared with the chat's tasks,
// and a removed worktree stops the session instead of falling back to the live checkout.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addMessage, createSession, loadSession, readEvents, type SessionAgent } from '../src/sessions.ts';
import { createTask } from '../src/tasks.ts';
import { runTurn } from '../src/turn.ts';
import { getProject, listProjects, registerProject } from '../src/store.ts';
import { addAppProject, addWorktree, appRepo, commitRoots, GUARD_MARK, guardedCommand, guardedPath, guardedTree, guardFor, isAppProject, listWorktrees, planWorktree } from '../src/worktrees.ts';
import { guardedRequest, sandboxPath } from '../src/adapters/codex.ts';
import { sessionEvents } from '../src/adapters/claude-code.ts';
import { forget, guardServer, guardToken } from '../src/guard.ts';

let root = '';
const git = (...args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim();
beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'ws-worktrees-'));
  process.env.AI_WORKSPACE_HOME = join(dir, 'home');
  process.env.AI_WORKSPACE_SESSION_IDLE_MS = '300';
  root = join(dir, 'project');
  mkdirSync(root);
  git('init', '-q', '-b', 'main');
  writeFileSync(join(root, 'a.txt'), 'a');
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'first');
  registerProject(root, 'P');
  process.env.AI_WORKSPACE_REPO = root; // this test repository plays the app's own
});

/** A fake agent that records the folder each run starts in. */
function recording(roots: string[]): Record<string, SessionAgent> {
  return { 'claude-code': { open: (_s, r) => { roots.push(r); return { turn: async () => ({}), close() {} }; }, permissions: () => ({ line: 'fake' }), catalog: () => ({ models: [] }), inventory: async () => [] } };
}

test('only the app project gets worktrees; it is added on start once, by folder', () => {
  assert.equal(isAppProject(getProject('P')), true);
  const other = mkdtempSync(join(tmpdir(), 'ws-other-'));
  assert.equal(isAppProject({ id: 'other', root: other }), false);
  assert.equal(planWorktree({ id: 'other', root: other }, 'x'), undefined);
  assert.equal(addAppProject()!.id, 'P'); // already a project with that folder: nothing added
  assert.equal(listProjects().length, 1);
  process.env.AI_WORKSPACE_HOME = mkdtempSync(join(tmpdir(), 'ws-fresh-'));
  assert.deepEqual(addAppProject(), { id: 'project', root: appRepo() }); // fresh storage: added under its folder name
  delete process.env.AI_WORKSPACE_REPO;
  assert.ok(appRepo()); // tests run from a checkout
});

test('a new session can continue an existing worktree instead of making one', async () => {
  const first = createSession('P', 'Chat', { integration: 'claude-code' });
  addMessage(first.id, 'start');
  await runTurn(first.id, recording([]));
  const made = loadSession(first.id).worktree!;
  assert.deepEqual(listWorktrees(getProject('P')), [made]);
  const next = createSession('P', 'Chat', { integration: 'claude-code' }, { path: made.path });
  assert.deepEqual(next.worktree, made);
  const roots: string[] = [];
  addMessage(next.id, 'go on');
  await runTurn(next.id, recording(roots));
  assert.deepEqual(roots, [made.path]);
  assert.equal(readEvents(next.id).filter((e) => e.type === 'notice').length, 0); // nothing new was made
  assert.throws(() => createSession('P', 'Chat', { integration: 'claude-code' }, { path: root }), /Not a worktree of project P/);
  rmSync(root, { recursive: true, force: true });
});

test('a session works in its own worktree from the first turn; its tasks share it; a removed one stops it', async () => {
  const chat = createSession('P', 'Chat', { integration: 'claude-code' });
  const wt = loadSession(chat.id).worktree!;
  assert.equal(existsSync(wt.path), false); // planned, not made until it is used
  const roots: string[] = [];
  addMessage(chat.id, 'start');
  await runTurn(chat.id, recording(roots));
  assert.deepEqual(roots, [wt.path]);
  assert.ok(existsSync(join(wt.path, 'a.txt')));
  assert.equal(git('branch', '--list', '--format=%(refname:short)', wt.branch), wt.branch);
  assert.ok(readEvents(chat.id).some((e) => e.type === 'notice' && e.text.includes(`branch ${wt.branch}, from `)));
  const t = createTask({ projectId: 'P', goal: 'edit', role: 'Implementation', sessionId: chat.id, setup: ['tool:Read'] });
  assert.deepEqual(t.worktree, { ...wt, ready: true });
  await runTurn(t.id, recording(roots));
  assert.equal(roots.at(-1), wt.path);
  git('worktree', 'remove', '--force', wt.path);
  addMessage(chat.id, 'again');
  await runTurn(chat.id, recording(roots));
  assert.equal(roots.length, 2); // no agent started in the live checkout
  assert.ok(readEvents(chat.id).some((e) => e.type === 'error' && /worktree is gone/.test(e.message)));
  rmSync(root, { recursive: true, force: true });
});

test('a new worktree gets its npm dependencies before the agent starts; a failed install is reported, not fatal (#26)', async () => {
  // The test repository gets a lockfile in app/, and a fake npm records where it ran and whether Electron is skipped.
  mkdirSync(join(root, 'app'));
  writeFileSync(join(root, 'app', 'package-lock.json'), '{}');
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'lockfile');
  const fake = join(dirname(root), 'fake-npm.mjs');
  writeFileSync(fake, `import { writeFileSync } from 'node:fs';
if (process.env.FAKE_NPM_FAIL) { console.error('npm error code E404'); process.exit(1); }
writeFileSync('installed.txt', process.argv.slice(2).join(' ') + ' ' + process.env.ELECTRON_SKIP_BINARY_DOWNLOAD);
console.log('added 3 packages');`);
  process.env.AI_WORKSPACE_NPM = fake;
  try {
    const chat = createSession('P', 'Chat', { integration: 'claude-code' });
    const wt = loadSession(chat.id).worktree!;
    const roots: string[] = [];
    addMessage(chat.id, 'start');
    await runTurn(chat.id, recording(roots));
    assert.equal(readFileSync(join(wt.path, 'app', 'installed.txt'), 'utf8'), 'ci --no-audit --no-fund 1');
    const notices = readEvents(chat.id).filter((e) => e.type === 'notice').map((e) => e.type === 'notice' ? e.text : '');
    assert.ok(notices.some((t) => /Installing dependencies in app\//.test(t)) && notices.some((t) => /Dependencies installed in app\//.test(t)), notices.join(' | '));
    assert.deepEqual(roots, [wt.path], 'the agent started after the install');
    process.env.FAKE_NPM_FAIL = '1';
    const other = createSession('P', 'Chat', { integration: 'claude-code' });
    addMessage(other.id, 'start');
    await runTurn(other.id, recording(roots));
    assert.equal(roots.length, 2, 'the session still starts');
    assert.ok(readEvents(other.id).some((e) => e.type === 'notice' && /failed \(npm ci, exit 1\)[\s\S]*E404/.test(e.text)));
  } finally {
    delete process.env.AI_WORKSPACE_NPM;
    delete process.env.FAKE_NPM_FAIL;
  }
});

test('a worktree that cannot be made on a too long path leaves no branch behind and says why (#22)', () => {
  // A worktree folder just under the system's path limit: it can be made, but Git's own folder in the checkout
  // for it cannot, so Git fails after it made the branch, as on the user's Windows storage path.
  const limit = process.platform === 'win32' ? 260 : process.platform === 'darwin' ? 1024 : 4096;
  const parts: string[] = [];
  while (join(dirname(root), ...parts).length < limit - 150) parts.push(`${parts.length}`.padEnd(100, 'x'));
  const base = join(dirname(root), ...parts);
  const deep = join(base, 'w'.padEnd(limit - 12 - base.length - 1, 'w'));
  assert.throws(() => addWorktree(root, { path: deep, branch: 'deep' }), /folder path is too long \(\d+ characters[^)]*\)[\s\S]*No branch was left behind/);
  assert.equal(git('branch', '--list', 'deep'), '');
  assert.equal(git('worktree', 'list').split('\n').length, 1);
});

test('a new worktree takes the name the user gives it; empty, invalid and taken names are refused', async () => {
  const chat = (worktree: { name?: string; path?: string }) => createSession('P', 'Chat', { integration: 'claude-code' }, worktree);
  assert.throws(() => chat({ name: ' ' }), /Enter a name for the new branch/);
  for (const bad of ['-x', 'a b', 'a/b', 'a..b', 'x.lock', 'a'.repeat(61)]) assert.throws(() => chat({ name: bad }), /not a valid branch name/, bad);
  assert.throws(() => chat({ name: 'main' }), /already exists/); // an existing branch
  const s = chat({ name: 'fix-login' });
  assert.equal(s.worktree!.branch, 'fix-login');
  addMessage(s.id, 'start');
  await runTurn(s.id, recording([]));
  assert.equal(git('branch', '--list', '--format=%(refname:short)', 'fix-login'), 'fix-login');
  assert.throws(() => chat({ name: 'fix-login' }), /already exists/);
  rmSync(root, { recursive: true, force: true });
});

test('the cleanup removes merged branches only, archives their chats, and leaves unmerged or unsaved work', async () => {
  const { branchInfo, cleanupBranches, removeBranch } = await import('../src/branches.ts');
  const start = async (name: string) => {
    const s = createSession('P', 'Chat', { integration: 'claude-code' }, { name });
    addMessage(s.id, 'go');
    await runTurn(s.id, recording([]));
    return loadSession(s.id);
  };
  const commit = (dir: string, file: string) => {
    writeFileSync(join(dir, file), file);
    for (const args of [['add', '.'], ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', file]]) spawnSync('git', args, { cwd: dir });
  };
  const fresh = await start('fresh'); // no commits yet: never taken
  const open = await start('open'); // a commit not in main
  commit(open.worktree!.path, 'open.txt');
  const done = await start('done'); // merged into main
  commit(done.worktree!.path, 'done.txt');
  git('merge', '-q', '--ff-only', 'done');
  const unsaved = await start('unsaved'); // merged but with uncommitted changes
  commit(unsaved.worktree!.path, 'unsaved.txt');
  git('merge', '-q', '--no-edit', 'unsaved');
  writeFileSync(join(unsaved.worktree!.path, 'draft.txt'), 'x');
  const state = Object.fromEntries(branchInfo(getProject('P')).map((b) => [b.branch, [b.merged, b.ahead, b.dirty]]));
  assert.deepEqual(state, { fresh: [false, 0, false], open: [false, 1, false], done: [true, 0, false], unsaved: [true, 0, true] });
  assert.deepEqual(cleanupBranches(), ['done']);
  assert.equal(existsSync(done.worktree!.path), false);
  assert.equal(git('branch', '--list', 'done'), '');
  assert.equal(loadSession(done.id).archived, true); // its chat is archived, the others are not
  assert.equal(loadSession(open.id).archived, undefined);
  assert.throws(() => removeBranch(open.worktree!.path), /1 unmerged commit; removing it loses that work/);
  removeBranch(open.worktree!.path, true);
  assert.equal(existsSync(open.worktree!.path), false);
  assert.equal(loadSession(open.id).archived, true);
  assert.deepEqual(branchInfo(getProject('P')).map((b) => b.branch).sort(), ['fresh', 'unsaved']);
  rmSync(root, { recursive: true, force: true });
});

test('the write guard keeps agents out of the live checkout and storage, except their own worktree (selfdev-002)', () => {
  const store = process.env.AI_WORKSPACE_HOME!;
  const wt = join(store, 'worktrees', 'P', 'fix');
  const g = guardFor(wt);
  assert.deepEqual(g.deny, [root, store]);
  // Files: the deepest folder decides, so the own worktree is free and everything around it is not.
  assert.equal(guardedPath(g, join(wt, 'src', 'a.ts')), undefined);
  assert.equal(guardedPath(g, join(root, 'a.txt')), root);
  assert.equal(guardedPath(g, join(store, 'sessions', 'x.json')), store);
  assert.equal(guardedPath(g, '../other/a.txt'), store);
  assert.equal(guardedPath(g, join(tmpdir(), 'elsewhere.txt')), undefined);
  // A project folder holding the checkout does not free it.
  assert.equal(guardedPath({ ...g, allow: dirname(root) }, join(root, 'a.txt')), root);
  // Commands: path words, relative climbs, home spellings and paths inside quoted code.
  const live = root.replaceAll('\\', '/');
  assert.equal(guardedCommand(g, 'npm ci && npm test'), undefined);
  assert.equal(guardedCommand(g, `cd "${wt}" && git commit -m "x"`), undefined);
  assert.equal(guardedCommand(g, 'git log main..HEAD -- src/a.ts'), undefined);
  assert.equal(guardedCommand(g, `cp a.txt "${live}/a.txt"`), root);
  assert.equal(guardedCommand(g, `echo x > ${root}\\a.txt`), root);
  assert.equal(guardedCommand(g, 'rm -rf ../../..'), store);
  assert.equal(guardedCommand(g, `node -e "require('fs').writeFileSync('${live}/b', '')"`), root);
  assert.equal(guardedCommand(g, 'npm test', root), root, 'a command run in the checkout');
  // Commands that only read may name the checkout or run in it (user, 2026-10-19).
  for (const c of [`git -C "${live}" log --oneline -5`, `cd "${live}" && git status && git diff main -- app/src | head -50`, `cat ${root}/AGENTS.md 2>&1`, `grep -rn guard "${live}/app/src" > /dev/null`, `Get-Content '${root}\\a.txt' | Select-String x`, `git -C ${live} branch -a`, `find ${live} -name '*.ts'`]) {
    assert.equal(guardedCommand(g, c), undefined, c);
  }
  assert.equal(guardedCommand(g, 'git log -5', root), undefined, 'reading in the checkout');
  for (const c of [`cat a > ${live}/b`, `cd ${live} && git checkout -b x`, `git -C ${live} branch x`, `find ${live} -name x -delete`, `cat $(echo ${live}/a) | sh`, `git -c core.pager=sh -C ${live} log`, `git -C ${live} diff --output=x`, `ls ${live}; rm ${live}/a`, `cat a | tee ${live}/b`]) {
    assert.equal(guardedCommand(g, c), root, c);
  }
  if (process.platform === 'win32') assert.equal(guardedCommand(g, `touch /${live[0]}${live.slice(2)}/a.txt`), root, 'Git Bash spelling');
  // Write access to a folder that holds a guarded one.
  assert.equal(guardedTree(g, dirname(root)), root);
  assert.equal(guardedTree(g, wt), undefined);
});

test('Codex approval requests that would write into guarded folders are declined (selfdev-002)', () => {
  const store = process.env.AI_WORKSPACE_HOME!;
  const g = guardFor(join(store, 'worktrees', 'P', 'fix'));
  const edits = new Map([['e1', [join(root, 'a.txt')]], ['e2', [join(g.allow, 'a.txt')]]]);
  assert.equal(guardedRequest(g, 'item/commandExecution/requestApproval', { command: 'git commit -m x', cwd: g.allow }, edits), undefined);
  assert.equal(guardedRequest(g, 'item/commandExecution/requestApproval', { command: 'npm install', cwd: root }, edits), root);
  assert.equal(guardedRequest(g, 'item/fileChange/requestApproval', { itemId: 'e1' }, edits), root);
  assert.equal(guardedRequest(g, 'item/fileChange/requestApproval', { itemId: 'e2' }, edits), undefined);
  assert.equal(guardedRequest(g, 'item/fileChange/requestApproval', { itemId: 'x', grantRoot: dirname(root) }, edits), root);
  assert.equal(guardedRequest(g, 'item/permissions/requestApproval', { permissions: { fileSystem: { entries: [{ access: 'write', path: { type: 'special', kind: 'root' } }] } } }, edits), root);
  assert.equal(guardedRequest(g, 'item/permissions/requestApproval', { permissions: { fileSystem: { write: [store] } } }, edits), store);
  assert.equal(guardedRequest(g, 'item/permissions/requestApproval', { permissions: { network: { enabled: true } } }, edits), undefined);
});

test('the Claude Code hook denies a guarded write and lets the own worktree through', () => {
  const hook = fileURLToPath(new URL('../src/guard-hook.ts', import.meta.url));
  const g = guardFor(join(process.env.AI_WORKSPACE_HOME!, 'worktrees', 'P', 'fix'));
  const run = (tool_name: string, tool_input: object) => spawnSync(process.execPath, [hook, g.allow, ...g.deny], { input: JSON.stringify({ tool_name, tool_input, cwd: g.allow }), encoding: 'utf8' }).stdout;
  const out = JSON.parse(run('Write', { file_path: join(root, 'a.txt'), content: 'x' }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(run('Edit', { file_path: join(g.allow, 'a.txt') }), '');
  const denied = JSON.parse(run('Bash', { command: `rm "${root}/a.txt"` })).hookSpecificOutput;
  assert.equal(denied.permissionDecision, 'deny');
  // The chat shows the reason's first paragraph as a notice, with the command, so a reading one can be listed.
  const line = JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', is_error: true, content: `PreToolUse:Bash hook error: ${denied.permissionDecisionReason}` }] } });
  const notice = sessionEvents(line, g.allow).events.find((e) => e.type === 'notice');
  assert.ok(notice?.type === 'notice' && notice.text.startsWith(GUARD_MARK) && notice.text.includes(`rm "${root}/a.txt"`) && notice.text.includes('READERS') && !notice.text.includes('\n'));
});

test('the guard server answers only its runs, by token, with the same decision as the hook (selfdev-002)', async () => {
  const url = (await guardServer())!;
  const g = guardFor(join(process.env.AI_WORKSPACE_HOME!, 'worktrees', 'P', 'fix'));
  const token = guardToken(g);
  const ask = (tool_input: object, t = token) => fetch(url, { method: 'POST', headers: { 'x-aiws-token': t }, body: JSON.stringify({ tool_name: 'Write', tool_input, cwd: g.allow }) });
  const denied = await (await ask({ file_path: join(root, 'a.txt') })).json() as { hookSpecificOutput?: { permissionDecision: string; permissionDecisionReason: string } };
  assert.equal(denied.hookSpecificOutput?.permissionDecision, 'deny');
  assert.ok(denied.hookSpecificOutput.permissionDecisionReason.startsWith(GUARD_MARK));
  assert.deepEqual(await (await ask({ file_path: join(g.allow, 'a.txt') })).json(), {});
  assert.equal((await ask({ file_path: join(root, 'a.txt') }, 'wrong')).status, 403);
  forget(token);
  assert.equal((await ask({ file_path: join(root, 'a.txt') })).status, 403, 'a finished run is gone');
  assert.equal(await guardServer(), url, 'one server per process');
});

test('a worktree commit may write only its own git folder, objects and branch refs in the checkout (Codex sandbox)', () => {
  const wt = join(dirname(root), 'wt');
  git('worktree', 'add', '-q', '-b', 'fix', wt);
  // Real paths, since git reports them (macOS /private/var, Windows long names).
  const real = (d: string) => realpathSync.native(d).replaceAll('\\', '/').toLowerCase();
  const roots = commitRoots(wt).map(real);
  const dotGit = real(join(root, '.git'));
  assert.deepEqual(roots, [`${dotGit}/worktrees/wt`, `${dotGit}/objects`, `${dotGit}/refs/heads`, `${dotGit}/logs/refs/heads`]);
});

test('Codex gets the real folder of a linked program before its link, so its sandbox can run it (#21)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ws-links-'));
  const links = join(dir, 'Links'), pkg = join(dir, 'Packages', 'rtk'), plain = join(dir, 'bin');
  for (const d of [links, pkg, plain]) mkdirSync(d, { recursive: true });
  writeFileSync(join(pkg, 'rtk.exe'), '');
  writeFileSync(join(plain, 'git.exe'), '');
  try { symlinkSync(join(pkg, 'rtk.exe'), join(links, 'rtk.exe')); } catch { t.skip('no permission to make links here'); return; }
  const real = realpathSync(pkg);
  assert.equal(sandboxPath([plain, links, join(dir, 'missing')].join(delimiter)), [plain, real, links, join(dir, 'missing')].join(delimiter));
  assert.equal(sandboxPath([links, links].join(delimiter)), [real, links].join(delimiter), 'each folder once');
});
