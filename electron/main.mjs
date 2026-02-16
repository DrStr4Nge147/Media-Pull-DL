import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runYtDlp, getYtDlpVersion, updateYtDlp, getVideoMetadata, getPlaylistMetadata, bootstrapYtDlp } from './yt-dlp-runner.mjs';

const isDev = !app.isPackaged;

// Set app name for Windows notifications
if (process.platform === 'win32') {
  app.setAppUserModelId('Media-Pull DL');
}

const activeDownloads = new Map(); // id => child process

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJson = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const appVersion = packageJson.version;

const getDevServerUrl = () => {
  return process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
};

const resolveDestination = (destination) => {
  if (!destination || typeof destination !== 'string') {
    return app.getPath('downloads');
  }

  if (path.isAbsolute(destination)) return destination;

  const base = app.getPath('downloads');
  return path.resolve(base, destination);
};

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 1150,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    title: `Media-Pull DL v${appVersion}`,
    icon: path.join(__dirname, '..', 'public', 'logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    await win.loadURL(getDevServerUrl());
  } else {
    await win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  win.focus();
};

ipcMain.handle('open-download-folder', async (_event, destination) => {
  const targetPath = resolveDestination(destination);
  await fs.mkdir(targetPath, { recursive: true });
  const result = await shell.openPath(targetPath);
  if (result) {
    throw new Error(result);
  }
  return true;
});

ipcMain.handle('open-and-select-file', async (_event, { destination, filename }) => {
  const targetDir = resolveDestination(destination);

  try {
    const files = await fs.readdir(targetDir);
    // Try to find a file that matches the filename or starts with it (ignoring extension)
    // Filename in history might be sanitized
    const baseName = filename.replace(/\.[^/.]+$/, ""); // remove extension if exists

    const matchedFile = files.find(f => f === filename || f.startsWith(baseName));

    if (matchedFile) {
      shell.showItemInFolder(path.join(targetDir, matchedFile));
      return true;
    }
  } catch (e) {
    console.error('Error selecting file:', e);
  }

  // Fallback to just opening the folder
  await shell.openPath(targetDir);
  return true;
});

ipcMain.handle('open-external', async (_event, url) => {
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('send-notification', async (_event, { title, body }) => {
  const { Notification } = await import('electron');
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, '..', 'public', 'logo.png'),
    });
    notification.show();
  }
  return true;
});

ipcMain.handle('run-yt-dlp', async (event, payload) => {
  const progressCallback = (p) => event.sender.send('yt-dlp-progress', { id: payload.id, progress: p });
  const logCallback = (line) => event.sender.send('yt-dlp-log', { id: payload.id, log: line });
  const onCreated = (child) => {
    activeDownloads.set(payload.id, child);
  };

  try {
    await runYtDlp(payload, progressCallback, logCallback, onCreated);
    return true;
  } catch (error) {
    console.error(`Download ${payload.id} failed:`, error);
    return false;
  } finally {
    activeDownloads.delete(payload.id);
  }
});

ipcMain.handle('pause-download', async (_event, id) => {
  const child = activeDownloads.get(id);
  if (child && !child.killed) {
    if (process.platform === 'win32') {
      const { exec } = await import('node:child_process');
      return new Promise((resolve) => {
        // Suspend threads using PowerShell
        exec(`powershell -command "$p = Get-Process -Id ${child.pid}; $p.Threads | ForEach-Object { try { $_.Suspend() } catch {} }"`, (err) => {
          resolve(!err);
        });
      });
    } else {
      child.kill('SIGSTOP');
    }
    return true;
  }
  return false;
});

ipcMain.handle('resume-download', async (_event, id) => {
  const child = activeDownloads.get(id);
  if (child && !child.killed) {
    if (process.platform === 'win32') {
      const { exec } = await import('node:child_process');
      return new Promise((resolve) => {
        // Resume threads using PowerShell
        exec(`powershell -command "$p = Get-Process -Id ${child.pid}; $p.Threads | ForEach-Object { try { $_.Resume() } catch {} }"`, (err) => {
          resolve(!err);
        });
      });
    } else {
      child.kill('SIGCONT');
    }
    return true;
  }
  return false;
});

ipcMain.handle('stop-download', async (_event, id) => {
  const child = activeDownloads.get(id);
  if (child && !child.killed) {
    if (process.platform === 'win32') {
      const { spawn: spawnChild } = await import('node:child_process');
      spawnChild('taskkill', ['/pid', child.pid, '/f', '/t']);
    } else {
      child.kill('SIGTERM');
    }
    activeDownloads.delete(id);
    return true;
  }
  return false;
});

const checkForUpdates = async (win) => {
  try {
    const currentVersion = await getYtDlpVersion();
    const response = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest');
    const data = await response.json();
    const latestVersion = data.tag_name; // usually looks like '2023.03.04' or '2023.03.04.1'

    // Clean up version strings (remove 'v' prefix and trim)
    const cleanCurrent = currentVersion.trim().replace(/^v/i, '');
    const cleanLatest = latestVersion.trim().replace(/^v/i, '');

    if (cleanCurrent !== cleanLatest) {
      win.webContents.send('yt-dlp-update-available', { current: currentVersion, latest: latestVersion });
    } else {
      win.webContents.send('yt-dlp-up-to-date', currentVersion);
    }
  } catch (error) {
    console.error('Failed to check for yt-dlp updates:', error);
  }
};

const checkForAppUpdates = async (win) => {
  try {
    const currentVersion = appVersion;
    const response = await fetch('https://api.github.com/repos/DrStr4Nge147/Media-Pull-DL/releases/latest');

    if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`);

    const data = await response.json();
    let latestVersion = data.tag_name;

    const cleanLatest = latestVersion.replace(/^v/i, '');
    const cleanCurrent = currentVersion.replace(/^v/i, '');

    // Find the .exe asset
    const exeAsset = data.assets.find(asset => asset.name.endsWith('.exe'));

    if (cleanCurrent !== cleanLatest) {
      console.log(`[App Update] Update available: ${cleanCurrent} -> ${cleanLatest}`);

      win.webContents.send('app-update-available', {
        current: currentVersion,
        latest: latestVersion,
        url: data.html_url,
        downloadUrl: exeAsset ? exeAsset.browser_download_url : null,
        assetName: exeAsset ? exeAsset.name : null,
        isPortable: !!process.env.PORTABLE_EXECUTABLE_PATH
      });
    } else {
      console.log(`[App Update] App is up to date: ${cleanCurrent}`);
      win.webContents.send('app-up-to-date', currentVersion);
    }
  } catch (error) {
    console.error('Failed to check for App updates:', error);
  }
};

ipcMain.handle('download-app-update', async (event, { downloadUrl, assetName }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const currentFile = process.env.PORTABLE_EXECUTABLE_PATH || app.getPath('exe');
  const currentDir = path.dirname(currentFile);
  const targetPath = path.join(currentDir, assetName);

  try {
    win.webContents.send('app-update-progress', { status: 'Downloading...', progress: 10 });

    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error('Failed to download update');

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(targetPath, Buffer.from(arrayBuffer));

    win.webContents.send('app-update-progress', { status: 'Download Complete!', progress: 100 });

    // Open the folder so user can see the new file
    await shell.showItemInFolder(targetPath);

    return { success: true };
  } catch (error) {
    console.error('Update download failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('close-app', () => {
  app.quit();
});

ipcMain.handle('get-video-metadata', async (_event, url) => {
  try {
    return await getVideoMetadata(url);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('get-playlist-metadata', async (_event, url) => {
  try {
    return await getPlaylistMetadata(url);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('get-yt-dlp-version', async () => {
  return getYtDlpVersion();
});

ipcMain.handle('check-yt-dlp-update', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return checkForUpdates(win);
});

ipcMain.handle('check-app-update', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return checkForAppUpdates(win);
});

ipcMain.handle('update-yt-dlp', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  try {
    await updateYtDlp((log) => win.webContents.send('yt-dlp-update-log', log));
    const newVersion = await getYtDlpVersion();
    return { success: true, version: newVersion };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-app-version', () => {
  return appVersion;
});

app.whenReady().then(async () => {
  // Bootstrap yt-dlp and ffmpeg in the background
  console.log('[System] Bootstrapping dependencies...');
  await bootstrapYtDlp((log) => console.log(log)).catch(console.error);

  await createWindow();
  const [win] = BrowserWindow.getAllWindows();
  if (win) {
    // Wait for content to load before sending update notification
    win.webContents.once('did-finish-load', () => {
      checkForUpdates(win);
      setTimeout(() => checkForAppUpdates(win), 2000); // Check for app updates slightly after yt-dlp check
    });
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
