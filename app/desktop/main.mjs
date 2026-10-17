// Electron shell: runs the workspace UI server with the system Node (so task runners are spawned by
// Node, not by Electron) and shows its page in a native window. Closing the window stops the server;
// tasks keep running in their own processes.
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
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

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 480,
    title: 'AI Workspace',
    backgroundColor: '#0a0a0c',
    titleBarStyle: 'hidden',
    // Native window buttons drawn over our titlebar (Windows/Linux); macOS keeps its traffic lights.
    titleBarOverlay: process.platform === 'darwin' ? undefined : { color: '#131316', symbolColor: '#9a9aa6', height: 42 },
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
  win.loadURL(`${url}?platform=${process.platform}`);
  return win;
}

ipcMain.handle('pick-folder', async (event) => {
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), { title: 'Select the project folder', properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

const appUserModelId = 'AIWorkspace.Desktop';
let mainWindow;

// One window: a second launch focuses the open one.
const primary = app.requestSingleInstanceLock();
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
    dialog.showErrorBox('AI Workspace could not start', e.message);
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => server?.kill());
