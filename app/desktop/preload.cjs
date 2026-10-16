// The only native capabilities the page gets.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
});
