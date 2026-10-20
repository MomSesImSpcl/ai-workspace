// Electron shell: runs the workspace UI server with the system Node (so task runners are spawned by
// Node, not by Electron) and shows its page in a native window. Closing the window stops the server;
// tasks keep running in their own processes.
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('..', import.meta.url));
let server;
// A fallback instance runs the last working version from its copy in storage (selfdev-006): it gets the commit it
// runs in AI_WORKSPACE_FALLBACK and the app checkout it fell back from in AI_WORKSPACE_REPO, which `appRepo` in
// app/src/worktrees.ts reads, so the app project, worktrees and write guard still point at the real checkout.
const fallbackCommit = process.env.AI_WORKSPACE_FALLBACK;
const repoDir = fallbackCommit && process.env.AI_WORKSPACE_REPO ? resolve(process.env.AI_WORKSPACE_REPO) : resolve(appDir, '..');
// Workspace storage, as `home` in app/src/store.ts.
const storage = () => process.env.AI_WORKSPACE_HOME ?? join(homedir(), '.ai-workspace');
// How long a new version has to load its page and data before it counts as failed.
const CHECK_MS = 60_000;

/** The Electron binary installed in an app folder (as `electronIn` in app/src/restart.ts), if any. */
function electronIn(dir) {
  try {
    const bin = join(dir, 'node_modules', 'electron', 'dist', readFileSync(join(dir, 'node_modules', 'electron', 'path.txt'), 'utf8').trim());
    return existsSync(bin) ? bin : undefined;
  } catch { return undefined; }
}

/** The recorded last working version (`last-good.json`, written by `recordLastGood` in app/src/restart.ts), if its copy is complete. */
function lastGood() {
  try {
    const lg = JSON.parse(readFileSync(join(storage(), 'last-good.json'), 'utf8'));
    return lg && existsSync(lg.electron) ? lg : undefined;
  } catch { return undefined; }
}

/** The commit this instance runs, read before anything starts so a later update cannot be mistaken for it. */
function headCommit() {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: appDir, encoding: 'utf8', windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn('node', ['src/cli.ts', 'ui', '--port', '0'], { cwd: appDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    server.stderr.on('data', (d) => (err += d));
    server.on('error', (e) => reject(new Error(`could not start Node (need Node >= 24 on PATH): ${e.message}`)));
    server.on('exit', (code) => reject(new Error(`UI server exited (${code}): ${err.trim()}`)));
    server.stdout.on('data', (d) => {
      const url = /http:\/\/127\.0\.0\.1:\d+\//.exec(String(d))?.[0];
      if (url) resolve(url);
    });
  });
}

// The window reopens where it was closed: size, position and maximized state.
const boundsPath = () => join(app.getPath('userData'), 'window.json');
function savedBounds() {
  try { return JSON.parse(readFileSync(boundsPath(), 'utf8')); } catch { return {}; }
}

function saveBounds(win) {
  try { writeFileSync(boundsPath(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() })); } catch {}
}

function createWindow(url) {
  const saved = savedBounds();
  const win = new BrowserWindow({
    width: saved.width ?? 1280,
    height: saved.height ?? 820,
    x: saved.x,
    y: saved.y,
    minWidth: 760,
    minHeight: 480,
    title: fallbackCommit ? `AI Workspace (last working version ${fallbackCommit.slice(0, 7)})` : 'AI Workspace',
    backgroundColor: '#262624',
    titleBarStyle: 'hidden',
    // Native window buttons drawn over our titlebar (Windows/Linux); macOS keeps its traffic lights.
    titleBarOverlay: process.platform === 'darwin' ? undefined : { color: '#1f1e1d', symbolColor: '#c2c0b6', height: 42 },
    webPreferences: { preload: fileURLToPath(new URL('preload.cjs', import.meta.url)), contextIsolation: true, sandbox: true },
  });
  // The window only ever shows the local workspace page; links elsewhere open in the browser.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, target) => {
    if (!target.startsWith(url)) e.preventDefault();
  });
  // Taskbar pin relaunches this app, not bare Electron.
  if (process.platform === 'win32') win.setAppDetails({ appId: appUserModelId, relaunchCommand: `"${process.execPath}" "${appDir}"`, relaunchDisplayName: 'AI Workspace' });
  if (saved.maximized) win.maximize();
  win.on('close', () => saveBounds(win));
  win.on('focus', () => win.flashFrame(false));
  win.on('blur', () => wantsAttention && win.flashFrame(true));
  win.loadURL(`${url}?platform=${process.platform}`);
  return win;
}

// Starts in the given folder (the workspace root) when it exists.
ipcMain.handle('pick-folder', async (event, title, start) => {
  const defaultPath = typeof start === 'string' && existsSync(start) ? start : undefined;
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), { title: typeof title === 'string' ? title : 'Select a folder', defaultPath, properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

// File dialogs for workspace export and import; the page only gets the chosen path.
const transferFilters = [{ name: 'AI Workspace export', extensions: ['aiworkspace'] }];
ipcMain.handle('save-export', async (event) => {
  const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), { title: 'Export workspace', defaultPath: `ai-workspace-${new Date().toISOString().slice(0, 10)}.aiworkspace`, filters: transferFilters });
  return result.canceled ? null : result.filePath;
});
ipcMain.handle('open-export', async (event) => {
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), { title: 'Import workspace', filters: transferFilters, properties: ['openFile'] });
  return result.canceled ? null : result.filePaths[0];
});

// Only existing folders, so the page cannot make the shell open files or URLs.
ipcMain.handle('open-folder', (_event, path) => {
  if (typeof path !== 'string' || !existsSync(path) || !statSync(path).isDirectory()) return 'not a folder';
  return shell.openPath(path);
});
// A file is only shown, selected in its folder, never opened or run; a folder is opened.
ipcMain.handle('show-path', (_event, path) => {
  if (typeof path !== 'string' || !existsSync(path)) return 'not found';
  if (statSync(path).isDirectory()) return shell.openPath(path);
  shell.showItemInFolder(path);
  return '';
});

// Restart reloads everything (shell, server, page) after code changes; agent work runs in its own processes and continues.
// The taskbar button blinks while a task waits for the user's approval and the window is not in front.
let wantsAttention = false;
ipcMain.on('attention', (_e, on) => {
  wantsAttention = on;
  // The page can still send this while a restart is closing the window.
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.flashFrame(on && !mainWindow.isFocused());
});

ipcMain.handle('restart', () => {
  const t0 = Date.now();
  const step = (what) => log(`${what} (+${Date.now() - t0} ms)`); // which step is slow when a restart hangs
  log('restart requested');
  app.releaseSingleInstanceLock(); // the new instance must not find the lock still held
  step('lock released');
  // Quitting, and even app.exit, sometimes leave this process hanging on Windows (log 2026-10-18), and Electron's
  // relauncher waits for it to end. So the new instance is started here, at once; it waits for the lock and then
  // ends this process if it is still there.
  if (mainWindow) saveBounds(mainWindow);
  step('window position saved');
  server?.kill();
  step('server stopped');
  const marks = [RELAUNCHED, `${REPLACES}${process.pid}`, HANDOVER];
  let child;
  if (fallbackCommit) {
    // A fallback instance restarts onto the app checkout it fell back from, not onto its own copy.
    const target = join(repoDir, 'app');
    const env = { ...process.env };
    delete env.AI_WORKSPACE_FALLBACK;
    delete env.AI_WORKSPACE_REPO;
    child = spawn(electronIn(target) ?? process.execPath, [target, ...marks], { cwd: target, env, detached: true, stdio: 'ignore' });
  } else {
    const args = [...process.argv.slice(1).filter((a) => a !== RELAUNCHED && a !== HANDOVER && !a.startsWith(REPLACES)), ...marks];
    child = spawn(process.execPath, args, { cwd: process.cwd(), detached: true, stdio: 'ignore' });
  }
  child.unref();
  // This instance stays, hidden, until the new one passes its startup check and ends it (selfdev-006). If the new
  // one ends first or takes too long, this one says why and offers the last working version.
  mainWindow?.hide();
  step(`new instance ${child.pid} started; waiting for its startup check`);
  let over = false;
  const failed = (why) => {
    if (over) return;
    over = true;
    try { child.kill(); } catch { /* already gone */ }
    offerFallback(`${why}${reasonOf(child.pid)}`);
  };
  child.on('error', (e) => failed(`The new version could not be started: ${e.message}`));
  child.on('exit', (code) => failed(`The new version ended during its startup check (exit ${code}).`));
  setTimeout(() => failed(`The new version did not pass its startup check within ${(CHECK_MS + 30_000) / 1000} s.`), CHECK_MS + 30_000);
});

/** Why instance `pid` failed, from its own lines in startup.log (it logs before it exits), or ''. */
function reasonOf(pid) {
  try {
    const line = readFileSync(join(app.getPath('userData'), 'startup.log'), 'utf8').split('\n').reverse().find((l) => l.includes(` pid ${pid} `) && /check failed|start failed/.test(l));
    return line ? `\n\nIt logged: ${line.slice(line.indexOf(' pid ') + ` pid ${pid} `.length)}` : '';
  } catch { return ''; }
}

/**
 * Shows why this version, or the one a restart started, did not start, and offers the last working version
 * (selfdev-006): its copy in storage is started with its own Electron, pointed at this checkout. A fallback
 * instance offers nothing further, so a broken copy cannot loop. Ends this process.
 */
async function offerFallback(reason) {
  log(`not started: ${reason.replace(/\s+/g, ' ')}`);
  const lg = fallbackCommit ? undefined : lastGood();
  const detail = `${reason}\n\nEach start step is logged in ${join(app.getPath('userData'), 'startup.log')}.`;
  if (!lg) {
    dialog.showErrorBox('AI Workspace could not start', `${detail}${fallbackCommit ? '' : '\n\nNo last working version is recorded yet: one is kept after a version from main passes its startup check.'}`);
    app.exit(1);
    return;
  }
  const { response } = await dialog.showMessageBox({
    type: 'error', title: 'AI Workspace could not start', message: 'This version of AI Workspace did not start.',
    detail: `${detail}\n\nThe last working version is ${lg.commit.slice(0, 7)} "${lg.subject}", which passed its startup check on ${lg.at.slice(0, 10)}.`,
    buttons: ['Start the last working version', 'Quit'], defaultId: 0, cancelId: 1, noLink: true,
  });
  if (response === 0) {
    app.releaseSingleInstanceLock();
    const copy = join(lg.path, 'app');
    spawn(lg.electron, [copy, RELAUNCHED], { cwd: copy, detached: true, stdio: 'ignore', env: { ...process.env, AI_WORKSPACE_FALLBACK: lg.commit, AI_WORKSPACE_REPO: repoDir } }).unref();
    log(`started the last working version ${lg.commit}`);
  }
  app.exit(response === 0 ? 0 : 1);
}

/**
 * The startup check (selfdev-006): resolves once the page reports that it loaded and read projects, tasks and
 * sessions (`ready` in app/desktop/preload.cjs); rejects with the reason when the page reports an error, fails to
 * load or crashes, the UI server ends, or nothing happens within CHECK_MS. Deliberately basic: features are tested
 * on their branch before they merge.
 */
function startupCheck(win) {
  return new Promise((pass, fail) => {
    const timer = setTimeout(() => fail(new Error(`the page did not finish loading within ${CHECK_MS / 1000} s`)), CHECK_MS);
    const done = (fn, arg) => { clearTimeout(timer); fn(arg); };
    ipcMain.once('ready', () => done(pass));
    ipcMain.once('startup-failed', (_e, message) => done(fail, new Error(`the page could not load its data: ${message}`)));
    win.webContents.once('did-fail-load', (_e, code, text) => done(fail, new Error(`the page did not load: ${text} (${code})`)));
    win.webContents.once('render-process-gone', (_e, d) => done(fail, new Error(`the page crashed: ${d.reason}`)));
    server.once('exit', (code) => done(fail, new Error(`the UI server ended (exit ${code})`)));
  });
}

const appUserModelId = 'AIWorkspace.Desktop';
// Start and restart decisions, so a restart that does not come back leaves a trace.
function log(line) {
  try { appendFileSync(join(app.getPath('userData'), 'startup.log'), `${new Date().toISOString()} pid ${process.pid} ${line}
`); } catch { /* best effort */ }
}
const RELAUNCHED = '--relaunched';
const REPLACES = '--replaces='; // the pid of the instance a restart replaces
const HANDOVER = '--handover'; // that instance waits for this one's startup check and shows a failure itself
let mainWindow;

// One window: a second launch focuses the open one. A restarted instance can start before the old one has
// let go of the lock, so it waits for it instead of quitting.
let primary = app.requestSingleInstanceLock();
for (let i = 0; !primary && process.argv.includes(RELAUNCHED) && i < 100; i++) {
  await new Promise((r) => setTimeout(r, 100));
  primary = app.requestSingleInstanceLock();
}
log(`start ${process.argv.includes(RELAUNCHED) ? '(restart) ' : ''}lock ${primary ? 'acquired' : 'held by another instance, quitting'}`);
if (!primary) app.quit();
// The instance a restart replaces waits, hidden, for this one's startup check (selfdev-006); older versions exit at
// once but may hang while exiting. Either way this one ends it once it passed the check.
const replaces = Number(process.argv.find((a) => a.startsWith(REPLACES))?.slice(REPLACES.length));
function endReplaced() {
  // The pid could belong to another program by now, so only an Electron process is ended.
  const image = process.platform === 'win32' ? spawnSync('tasklist', ['/FI', `PID eq ${replaces}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }).stdout : '';
  if (process.platform === 'win32' && !/^"electron\.exe"/im.test(image)) return;
  try { process.kill(replaces); log(`ended the replaced instance ${replaces}`); } catch { /* already gone */ }
}
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  if (!primary) return;
  if (process.platform === 'win32') app.setAppUserModelId(appUserModelId);
  const commit = headCommit();
  try {
    mainWindow = createWindow(await startServer());
    await startupCheck(mainWindow);
  } catch (e) {
    log(`check failed: ${e.message}`);
    // After a restart, the waiting old instance shows the failure and offers the fallback; otherwise this one does.
    if (replaces && process.argv.includes(HANDOVER) && alive(replaces)) app.exit(1);
    else { mainWindow?.hide(); offerFallback(`The app could not start: ${e.message}`); }
    return;
  }
  log(`startup check passed${fallbackCommit ? ` (last working version ${fallbackCommit})` : commit ? ` (${commit})` : ''}`);
  if (replaces) endReplaced();
  // Keep this version as the last working one (selfdev-006), in the background; `ws last-good` skips what does not count.
  if (commit && !fallbackCommit) {
    try {
      const out = openSync(join(app.getPath('userData'), 'last-good.log'), 'a');
      spawn('node', ['src/cli.ts', 'last-good', commit], { cwd: appDir, detached: true, windowsHide: true, stdio: ['ignore', out, out] }).unref();
    } catch (e) { log(`could not record the last working version: ${e.message}`); }
  }
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => server?.kill());
