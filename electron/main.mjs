import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron';
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

Menu.setApplicationMenu(null);

const activeDownloads = new Map(); // id => child process

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAssetPath = (...paths) => {
  return path.join(__dirname, '..', isDev ? 'public' : 'dist', ...paths);
};


const appVersion = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;

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
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    title: `Media-Pull DL v${appVersion}`,
    icon: getAssetPath('logo.ico'),
    show: false, // Don't show until ready-to-show to help with initial painting

    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    titleBarStyle: 'hidden',
    // On Windows, this allows the content to extend into the title bar area
  });

  win.on('maximize', () => {
    win.webContents.send('window-maximized-status', true);
  });

  win.on('unmaximize', () => {
    win.webContents.send('window-maximized-status', false);
  });

  if (isDev) {
    await win.loadURL(getDevServerUrl());
  } else {
    await win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  // Set initial background color based on any saved state or just default
  // Since we can't easily read localStorage from here, we rely on the renderer 
  // to tell us as soon as it loads.

  win.once('ready-to-show', () => {
    win.show();
  });

  win.focus();

  // Wait for content to load before sending update notification
  win.webContents.once('did-finish-load', () => {
    checkForUpdates(win);
    setTimeout(() => checkForAppUpdates(win), 2000);
  });
};

ipcMain.handle('window-minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.handle('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.handle('window-close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle('set-background-color', (event, color) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  console.log(`[IPC] Setting background color to: ${color}`);
  if (win) {
    win.setBackgroundColor(color);
  }
});

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
      icon: getAssetPath('logo.png'),

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
    if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`);

    const data = await response.json();
    const latestVersion = data.tag_name;

    if (!currentVersion || !latestVersion) {
      console.log('[yt-dlp] Could not determine versions, skipping check.');
      return;
    }

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
    // Use raw content to bypass API rate limits
    const response = await fetch('https://raw.githubusercontent.com/DrStr4Nge147/Media-Pull-DL/main/version.json');

    if (!response.ok) throw new Error(`Fetch Error: ${response.statusText}`);

    const data = await response.json();
    const latestVersion = data.version;

    if (!currentVersion || !latestVersion) {
      console.log('[App Update] Could not determine versions, skipping check.');
      return;
    }

    const cleanLatest = latestVersion.toString().replace(/^v/i, '').trim();
    const cleanCurrent = currentVersion.toString().replace(/^v/i, '').trim();

    if (cleanCurrent !== cleanLatest) {
      const isPortable = !!(
        process.env.PORTABLE_EXECUTABLE_PATH ||
        process.env.PORTABLE_EXECUTABLE_DIR ||
        app.getPath('exe').toLowerCase().includes('portable')
      );

      const exePath = app.getPath('exe').toLowerCase();
      const isInstalled = exePath.includes('appdata') || exePath.includes('program files');
      const isZip = !isInstalled && !isPortable;

      console.log(`[App Update] Update available: ${cleanCurrent} -> ${cleanLatest} (Portable: ${isPortable}, Zip: ${isZip})`);

      win.webContents.send('app-update-available', {
        current: currentVersion,
        latest: latestVersion,
        url: data.url,
        downloadUrl: isPortable
          ? (data.portableDownloadUrl || data.downloadUrl)
          : (isZip ? (data.zipDownloadUrl || data.downloadUrl) : data.downloadUrl),
        assetName: isPortable
          ? (data.portableAssetName || data.assetName)
          : (isZip ? (data.zipAssetName || data.assetName) : data.assetName),
        isPortable: isPortable,
        isZip: isZip
      });
    } else {
      console.log(`[App Update] App is up to date: ${cleanCurrent}`);
      win.webContents.send('app-up-to-date', currentVersion);
    }
  } catch (error) {
    console.error('Failed to check for App updates:', error);
  }
};



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

ipcMain.handle('download-app-update', async (event, { url, fileName }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const tempPath = path.join(app.getPath('temp'), fileName);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);

    const totalBytes = Number.parseInt(response.headers.get('content-length') || '0', 10);
    let downloadedBytes = 0;

    const fileStream = (await import('node:fs')).createWriteStream(tempPath);
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      fileStream.write(value);
      downloadedBytes += value.length;

      if (totalBytes > 0) {
        const progress = (downloadedBytes / totalBytes) * 100;
        win.webContents.send('app-update-progress', progress);
      }
    }

    fileStream.end();
    return { success: true, path: tempPath };
  } catch (error) {
    console.error('App download failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('quit-and-install', async (_event, filePath) => {
  const { spawn } = await import('node:child_process');

  // If it's an .exe, try to run it. If it's NSIS, it handles the rest.
  // We use /S for silent if possible, but let's just run it so user sees the installer.
  // However, for "overwrite from within", usually we just run it and quit.
  spawn(filePath, {
    detached: true,
    stdio: 'ignore'
  }).unref();

  app.quit();
});

const cleanupTempInstallers = async () => {
  try {
    const tempDir = app.getPath('temp');
    const files = await fs.readdir(tempDir);
    // Matches patterns like Media-Pull.DL.Setup.v0.4.2.exe, Media-Pull.DL.v0.4.2.zip, etc.
    const installerPattern = /^Media-Pull\.DL\.(Setup\.|Portable\.)?v.*\.(exe|zip)$/i;

    console.log('[Cleanup] Checking for old installers in:', tempDir);

    for (const file of files) {
      if (installerPattern.test(file)) {
        const filePath = path.join(tempDir, file);
        try {
          // Attempt to delete. This will fail if the file is currently in use (e.g., installer running)
          await fs.unlink(filePath);
          console.log(`[Cleanup] Deleted old installer: ${file}`);
        } catch (err) {
          // It's likely in use or already deleted, just skip
          console.log(`[Cleanup] Skipping ${file}: ${err.message}`);
        }
      }
    }
  } catch (error) {
    console.error('[Cleanup] Error during temp cleanup:', error);
  }
};

app.whenReady().then(() => {
  createWindow();

  // Cleanup old installers on startup
  cleanupTempInstallers();

  // Bootstrap yt-dlp and ffmpeg in the background to avoid blocking startup
  console.log('[System] Bootstrapping dependencies in background...');
  bootstrapYtDlp((log) => console.log(log)).catch(err => {
    console.error('[System] Bootstrap failed:', err);
  });
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
