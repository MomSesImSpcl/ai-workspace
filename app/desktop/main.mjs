// Electron shell: runs the workspace UI server with the system Node (so task runners are spawned by
// Node, not by Electron) and shows its page in a native window. Closing the window stops the server;
// tasks keep running in their own processes.
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('..', import.meta.url));
let server;

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
    title: 'AI Workspace',
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

// Restart reloads everything (shell, server, page) after code changes; agent work runs in its own processes and continues.
ipcMain.handle('restart', () => {
  log('restart requested');
  app.releaseSingleInstanceLock(); // the new instance must not find the lock still held
  app.relaunch({ args: [...process.argv.slice(1).filter((a) => a !== RELAUNCHED), RELAUNCHED] });
  // A plain quit sometimes never finishes on Windows (the windowless process stays and the relauncher waits for
  // it), so restart saves what quitting would and exits at once.
  if (mainWindow) saveBounds(mainWindow);
  server?.kill();
  log('exiting for restart');
  app.exit(0);
});

const appUserModelId = 'AIWorkspace.Desktop';
// Start and restart decisions, so a restart that does not come back leaves a trace.
function log(line) {
  try { appendFileSync(join(app.getPath('userData'), 'startup.log'), `${new Date().toISOString()} pid ${process.pid} ${line}
`); } catch { /* best effort */ }
}
const RELAUNCHED = '--relaunched';
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
app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  if (!primary) return;
  if (process.platform === 'win32') app.setAppUserModelId(appUserModelId);
  try {
    mainWindow = createWindow(await startServer());
  } catch (e) {
    log(`start failed: ${e.message}`);
    dialog.showErrorBox('AI Workspace could not start', e.message);
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => server?.kill());
