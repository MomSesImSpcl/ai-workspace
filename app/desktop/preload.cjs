// The only native capabilities the page gets.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  pickFolder: (title, start) => ipcRenderer.invoke('pick-folder', title, start),
  openFolder: (path) => ipcRenderer.invoke('open-folder', path),
  showPath: (path) => ipcRenderer.invoke('show-path', path),
  restart: () => ipcRenderer.invoke('restart'),
  attention: (on) => ipcRenderer.send('attention', !!on),
  saveExport: () => ipcRenderer.invoke('save-export'),
  openExport: () => ipcRenderer.invoke('open-export'),
  // The startup check (selfdev-006): the page reports that it loaded its data, or why it could not.
  ready: () => ipcRenderer.send('ready'),
  failed: (message) => ipcRenderer.send('startup-failed', String(message)),
});
