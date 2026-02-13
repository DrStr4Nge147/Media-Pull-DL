const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openDownloadFolder', async (destination) => {
  return ipcRenderer.invoke('open-download-folder', destination);
});

contextBridge.exposeInMainWorld('openAndSelectFile', async (destination, filename) => {
  return ipcRenderer.invoke('open-and-select-file', { destination, filename });
});

contextBridge.exposeInMainWorld('openExternal', async (url) => {
  return ipcRenderer.invoke('open-external', url);
});

contextBridge.exposeInMainWorld('runYtDlp', async (payload) => {
  return ipcRenderer.invoke('run-yt-dlp', payload);
});

contextBridge.exposeInMainWorld('getVideoMetadata', async (url) => {
  return ipcRenderer.invoke('get-video-metadata', url);
});

contextBridge.exposeInMainWorld('getPlaylistMetadata', async (url) => {
  return ipcRenderer.invoke('get-playlist-metadata', url);
});

contextBridge.exposeInMainWorld('pauseDownload', async (id) => {
  return ipcRenderer.invoke('pause-download', id);
});

contextBridge.exposeInMainWorld('resumeDownload', async (id) => {
  return ipcRenderer.invoke('resume-download', id);
});

contextBridge.exposeInMainWorld('stopDownload', async (id) => {
  return ipcRenderer.invoke('stop-download', id);
});

contextBridge.exposeInMainWorld('onYtDlpProgress', (callback) => {
  ipcRenderer.on('yt-dlp-progress', (_, data) => callback(data));
});

contextBridge.exposeInMainWorld('onYtDlpLog', (callback) => {
  ipcRenderer.on('yt-dlp-log', (_, data) => callback(data));
});

contextBridge.exposeInMainWorld('removeAllYtDlpListeners', () => {
  ipcRenderer.removeAllListeners('yt-dlp-progress');
  ipcRenderer.removeAllListeners('yt-dlp-log');
});

contextBridge.exposeInMainWorld('getYtDlpVersion', () => {
  return ipcRenderer.invoke('get-yt-dlp-version');
});

contextBridge.exposeInMainWorld('checkYtDlpUpdate', () => {
  return ipcRenderer.invoke('check-yt-dlp-update');
});

contextBridge.exposeInMainWorld('checkAppUpdate', () => {
  return ipcRenderer.invoke('check-app-update');
});

contextBridge.exposeInMainWorld('updateYtDlp', () => {
  return ipcRenderer.invoke('update-yt-dlp');
});

contextBridge.exposeInMainWorld('onYtDlpUpdateAvailable', (callback) => {
  ipcRenderer.on('yt-dlp-update-available', (_, data) => callback(data));
});

contextBridge.exposeInMainWorld('onYtDlpUpToDate', (callback) => {
  ipcRenderer.on('yt-dlp-up-to-date', (_, version) => callback(version));
});

contextBridge.exposeInMainWorld('onYtDlpUpdateLog', (callback) => {
  ipcRenderer.on('yt-dlp-update-log', (_, log) => callback(log));
});

contextBridge.exposeInMainWorld('removeUpdateListeners', () => {
  ipcRenderer.removeAllListeners('yt-dlp-update-available');
  ipcRenderer.removeAllListeners('yt-dlp-up-to-date');
  ipcRenderer.removeAllListeners('yt-dlp-update-log');
  ipcRenderer.removeAllListeners('app-update-available');
  ipcRenderer.removeAllListeners('app-up-to-date');
});

contextBridge.exposeInMainWorld('onAppUpdateAvailable', (callback) => {
  ipcRenderer.on('app-update-available', (_, data) => callback(data));
});

contextBridge.exposeInMainWorld('onAppUpToDate', (callback) => {
  ipcRenderer.on('app-up-to-date', (_, version) => callback(version));
});

contextBridge.exposeInMainWorld('getAppVersion', () => {
  return ipcRenderer.invoke('get-app-version');
});
