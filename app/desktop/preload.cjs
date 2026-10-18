// The only native capabilities the page gets.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  pickFolder: (title, start) => ipcRenderer.invoke('pick-folder', title, start),
  openFolder: (path) => ipcRenderer.invoke('open-folder', path),
  restart: () => ipcRenderer.invoke('restart'),
  attention: (on) => ipcRenderer.send('attention', !!on),
  saveExport: () => ipcRenderer.invoke('save-export'),
  openExport: () => ipcRenderer.invoke('open-export'),
});
