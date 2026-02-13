import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('openDownloadFolder', async (destination) => {
  return ipcRenderer.invoke('open-download-folder', destination);
});
