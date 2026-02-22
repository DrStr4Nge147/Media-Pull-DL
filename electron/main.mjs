import { app, BrowserWindow, ipcMain, shell, Menu, session } from 'electron';
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
  console.log('[System] Creating window...');
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
    // On Windows, frame: false is enough for a custom title bar.
    // content will extend into the title bar area automatically.
  });

  win.on('maximize', () => {
    win.webContents.send('window-maximized-status', true);
  });

  win.on('unmaximize', () => {
    win.webContents.send('window-maximized-status', false);
  });

  // Set listeners BEFORE loading to avoid race conditions
  win.once('ready-to-show', () => {
    console.log('[System] Window ready to show');
    win.show();
  });

  win.webContents.once('did-finish-load', () => {
    console.log('[System] Content finished loading');
    // Version checks are now handled by App.tsx on mount or via IPC
    setTimeout(() => checkForAppUpdates(win), 2000);
  });

  if (isDev) {
    await win.loadURL(getDevServerUrl()).catch(err => {
      console.error('[System] Failed to load dev server URL:', err);
    });
  } else {
    await win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html')).catch(err => {
      console.error('[System] Failed to load production file:', err);
    });
  }

  win.focus();
  return win;
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

let lastYtDlpCheck = 0;
const CHECK_COOLDOWN = 10 * 60 * 1000; // 10 minutes

const checkForUpdates = async (win) => {
  const now = Date.now();
  if (now - lastYtDlpCheck < CHECK_COOLDOWN) {
    console.log('[yt-dlp] Check cooldown active, skipping update check.');
    return;
  }
  lastYtDlpCheck = now;

  const tryGetLatestVersion = async () => {
    // Method 1: GitHub API (fast, but rate-limited)
    try {
      console.log('[yt-dlp] Attempting version check via GitHub API...');
      const response = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
        headers: { 'User-Agent': 'Media-Pull-DL' }
      });
      if (response.ok) {
        const data = await response.json();
        return data.tag_name;
      }
      if (response.status === 403) {
        console.warn('[yt-dlp] GitHub API Rate Limit exceeded.');
      }
    } catch (e) {
      console.error('[yt-dlp] API check failed:', e.message);
    }

    // Method 2: Redirect URL parsing (Fallback, bypasses API quota)
    try {
      console.log('[yt-dlp] Falling back to redirect URL version check...');
      // By using a standard fetch on the latest release URL, we can see where it redirects
      const response = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest', {
        method: 'HEAD', // HEAD is enough to get the redirect URL
        redirect: 'follow'
      });

      const finalUrl = response.url;
      // URL format: https://github.com/yt-dlp/yt-dlp/releases/tag/2026.02.21
      const match = finalUrl.match(/\/tag\/([^/]+)$/);
      if (match && match[1]) {
        console.log('[yt-dlp] Version extracted from redirect URL:', match[1]);
        return match[1];
      }
    } catch (e) {
      console.error('[yt-dlp] Mirror/Redirect check failed:', e.message);
    }

    return null;
  };

  try {
    const currentVersion = await getYtDlpVersion();
    const latestVersion = await tryGetLatestVersion();

    if (!latestVersion) {
      throw new Error('All version check methods failed (Rate limit or Connection issue)');
    }

    console.log(`[yt-dlp] Check Results: Local=${currentVersion}, Latest=${latestVersion}`);

    if (!currentVersion) {
      console.log('[yt-dlp] Could not determine local version, skipping check.');
      return;
    }

    // Clean up version strings (remove 'v' prefix and trim)
    const cleanCurrent = currentVersion.toString().trim().replace(/^v/i, '');
    const cleanLatest = latestVersion.toString().trim().replace(/^v/i, '');

    if (cleanCurrent !== cleanLatest) {
      console.log(`[yt-dlp] Update available: ${cleanCurrent} -> ${cleanLatest}`);
      win.webContents.send('yt-dlp-update-available', { current: currentVersion, latest: latestVersion });
    } else {
      console.log('[yt-dlp] Core is already up to date.');
      win.webContents.send('yt-dlp-up-to-date', currentVersion);
    }
  } catch (error) {
    console.error('[yt-dlp] Core update check failed:', error);
    if (error.message.toLowerCase().includes('rate limit')) {
      win.webContents.send('yt-dlp-update-error', 'GitHub API rate limit exceeded. Mirror check also failed.');
    } else {
      win.webContents.send('yt-dlp-update-error', `Update check failed: ${error.message}`);
    }
  }
};

const getAppDistInfo = () => {
  const portablePath = process.env.PORTABLE_EXECUTABLE_PATH;
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  const exePath = app.getPath('exe').toLowerCase();

  const isPortable = !!(
    portablePath ||
    portableDir ||
    exePath.includes('portable')
  );

  // NSIS installer usually puts the app in AppData\Local\Programs or Program Files
  // Exclude Temp directory from "installed" detection as portable exes extract there
  const isInstalled = (exePath.includes('appdata') && !exePath.includes('temp')) ||
    exePath.includes('program files') ||
    exePath.includes('local\\programs');

  const isZip = !isInstalled && !isPortable;

  // Resolve the "Actual" directory where the app/exe is located
  let appDir;
  if (portableDir) {
    appDir = portableDir;
  } else if (portablePath) {
    appDir = path.dirname(portablePath);
  } else {
    appDir = path.dirname(app.getPath('exe'));
  }

  console.log(`[Dist Info] Mode: ${isPortable ? 'Portable' : isInstalled ? 'Installed' : 'Zip'}, AppDir: ${appDir}, ExePath: ${exePath}`);
  if (isPortable) console.log(`[Dist Info] Portable Env: Path=${portablePath}, Dir=${portableDir}`);

  return { isPortable, isZip, isInstalled, portablePath, portableDir, appDir, exePath };
};

const checkForAppUpdates = async (win) => {
  const tryGetLatestAppVersion = async () => {
    // Method 1: Raw JSON from repo (Bypasses API rate limits)
    try {
      console.log('[App Update] Fetching version metadata from repo...');
      const response = await fetch('https://raw.githubusercontent.com/DrStr4Nge147/Media-Pull-DL/main/version.json');
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (e) {
      console.error('[App Update] JSON fetch failed:', e.message);
    }

    // Method 2: Redirect URL parsing (Fallback, bypasses API quota)
    try {
      console.log('[App Update] Falling back to release-page scraping...');
      const response = await fetch('https://github.com/DrStr4Nge147/Media-Pull-DL/releases/latest', {
        method: 'HEAD',
        redirect: 'follow'
      });

      const finalUrl = response.url;
      const match = finalUrl.match(/\/tag\/([^/]+)$/);
      if (match && match[1]) {
        const latestTag = match[1].replace(/^v/i, '').trim();
        console.log('[App Update] Version extracted from redirect URL:', latestTag);

        // Build a mock data object based on the extracted tag
        return {
          version: latestTag,
          url: "https://github.com/DrStr4Nge147/Media-Pull-DL/releases/latest",
          downloadUrl: `https://github.com/DrStr4Nge147/Media-Pull-DL/releases/download/v${latestTag}/Media-Pull.DL.Setup.v${latestTag}.exe`,
          assetName: `Media-Pull.DL.Setup.v${latestTag}.exe`,
          portableDownloadUrl: `https://github.com/DrStr4Nge147/Media-Pull-DL/releases/download/v${latestTag}/Media-Pull.DL.Portable.v${latestTag}.exe`,
          portableAssetName: `Media-Pull.DL.Portable.v${latestTag}.exe`,
          zipDownloadUrl: `https://github.com/DrStr4Nge147/Media-Pull-DL/releases/download/v${latestTag}/Media-Pull.DL.v${latestTag}.zip`,
          zipAssetName: `Media-Pull.DL.v${latestTag}.zip`
        };
      }
    } catch (e) {
      console.error('[App Update] Release-page check failed:', e.message);
    }

    return null;
  };

  try {
    const currentVersion = appVersion;
    const data = await tryGetLatestAppVersion();

    if (!data || !data.version) {
      console.log('[App Update] All version check methods failed.');
      return;
    }

    const latestVersion = data.version;

    const cleanLatest = latestVersion.toString().replace(/^v/i, '').trim();
    const cleanCurrent = currentVersion.toString().replace(/^v/i, '').trim();

    if (cleanCurrent !== cleanLatest) {
      const { isPortable, isZip } = getAppDistInfo();

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
    await updateYtDlp(
      (log) => win.webContents.send('yt-dlp-update-log', log),
      (progress) => win.webContents.send('yt-dlp-update-progress', progress)
    );
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

  const { isPortable, appDir } = getAppDistInfo();

  // Set download path based on mode
  let downloadPath;
  if (isPortable) {
    // For portable mode, download to the same directory as the current portable exe
    downloadPath = path.join(appDir, fileName);
    console.log(`[App Update] Portable mode detected. Downloading next to exe: ${downloadPath}`);
  } else {
    // For zip or installed mode, download to temp
    downloadPath = path.join(app.getPath('temp'), fileName);
    console.log(`[App Update] Standard/Zip mode detected. Downloading to temp: ${downloadPath}`);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);

    const totalBytes = Number.parseInt(response.headers.get('content-length') || '0', 10);
    let downloadedBytes = 0;

    const fileStream = (await import('node:fs')).createWriteStream(downloadPath);
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
    return { success: true, path: downloadPath };
  } catch (error) {
    console.error('App download failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('factory-reset', async () => {
  try {
    // 1. Cleanup temp installers and updater folders
    await cleanupTempInstallers();
    const updaterPath = path.join(app.getPath('userData'), '..', 'mediapull-dl-updater');
    await fs.rm(updaterPath, { recursive: true, force: true }).catch(() => { });

    // 2. Clear app session/cache data to free up space
    const ses = session.defaultSession;
    await ses.clearCache();
    await ses.clearStorageData({
      storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
    });

    // 3. Optional: We could clear app cache here, but it might crash the current process.
    // Instead, we'll return success and let the renderer clear localStorage and reload.
    return { success: true };
  } catch (error) {
    console.error('Factory reset failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('quit-and-install', async (_event, filePath) => {
  const { spawn } = await import('node:child_process');
  const isZip = filePath.toLowerCase().endsWith('.zip');

  if (isZip) {
    console.log(`[App Update] Zip update detected. Preparing extraction for ${filePath}...`);
    const { appDir, exePath } = getAppDistInfo();
    const tempBatchPath = path.join(app.getPath('temp'), 'update-mediapull.bat');

    // Create a batch script to handle extraction after the app closes
    const batchContent = `
@echo off
setlocal
echo Waiting for application to exit...
taskkill /f /pid ${process.pid} >nul 2>&1
timeout /t 2 /nobreak >nul

echo Extracting updates to ${appDir}...
powershell -NoProfile -Command "Expand-Archive -Path '${filePath.replace(/'/g, "''")}' -DestinationPath '${appDir.replace(/'/g, "''")}' -Force"

echo Starting application...
start "" "${exePath}"

echo Cleaning up...
del "${filePath}"
(goto) 2>nul & del "%~f0"
    `.trim();

    await fs.writeFile(tempBatchPath, batchContent);

    spawn('cmd.exe', ['/c', tempBatchPath], {
      detached: true,
      stdio: 'ignore'
    }).unref();

    app.quit();
    return;
  }

  // If it's an .exe, try to run it. If it's NSIS, it handles the rest.
  spawn(filePath, {
    detached: true,
    stdio: 'ignore'
  }).unref();

  app.quit();
});

const cleanupTempInstallers = async () => {
  try {
    const tempDir = app.getPath('temp');
    const updaterDir = path.join(app.getPath('userData'), '..', 'mediapull-dl-updater');

    // Patterns for installers
    const installerPattern = /^Media-Pull\.DL\.(Setup\.|Portable\.)?v(.*?)\.(exe|zip)$/i;
    const genericInstallerName = 'installer.exe';

    const cleanDir = async (dirPath, isUpdaterDir = false) => {
      try {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
          let shouldDelete = false;

          if (isUpdaterDir && file.toLowerCase() === genericInstallerName) {
            // In the updater dir, we'll be aggressive after a successful update restart
            shouldDelete = true;
          } else {
            const match = file.match(installerPattern);
            if (match) {
              const fileVersion = match[2];
              // If file version is less than or equal to current version, it's junk
              if (fileVersion <= appVersion) {
                shouldDelete = true;
              }
            }
          }

          if (shouldDelete) {
            const filePath = path.join(dirPath, file);
            await fs.unlink(filePath).catch(() => { });
          }
        }
      } catch (e) {
        // Directory might not exist, ignore
      }
    };

    console.log('[Cleanup] Running smart maintenance...');
    await cleanDir(tempDir);
    await cleanDir(updaterDir, true);

  } catch (error) {
    console.error('[Cleanup] Error during smart maintenance:', error);
  }
};

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow().then((win) => {
    // Setup periodic checks (every 30 minutes)
    setInterval(() => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        checkForUpdates(windows[0]);
        checkForAppUpdates(windows[0]);
      }
    }, 30 * 60 * 1000);
  });

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
