import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { pipeline } from 'node:stream/promises';

const isDev = !app.isPackaged;

const getExecutablePath = async () => {
  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  if (isDev) {
    const localPath = path.join(app.getAppPath(), 'bin', binaryName);
    try {
      await fs.access(localPath);
      return localPath;
    } catch {
      return 'yt-dlp';
    }
  }
  return path.join(process.resourcesPath, binaryName);
};

const getBinDir = () => {
  return isDev ? path.join(app.getAppPath(), 'bin') : process.resourcesPath;
};

export const bootstrapYtDlp = async (onLog) => {
  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const binDir = getBinDir();
  const targetPath = path.join(binDir, binaryName);
  const ffmpegPath = path.join(binDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');

  try {
    await fs.mkdir(binDir, { recursive: true });

    // 1. Check/Download yt-dlp
    try {
      await fs.access(targetPath);
      onLog(`[bootstrap] yt-dlp already exists at ${targetPath}`);
    } catch {
      onLog('[bootstrap] yt-dlp missing. Starting automatic download...');
      try {
        const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binaryName}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to download yt-dlp: ${response.statusText}`);

        const fileStream = createWriteStream(targetPath);
        await pipeline(response.body, fileStream);

        if (process.platform !== 'win32') {
          await fs.chmod(targetPath, 0o755);
        }
        onLog('[bootstrap] yt-dlp downloaded successfully.');
      } catch (error) {
        onLog(`[bootstrap] Error downloading yt-dlp: ${error.message}`);
        return false;
      }
    }

    // 2. Check/Download FFmpeg (Windows only for now, Linux/Mac expected to have it or use package manager)
    // Only download if missing
    if (process.platform === 'win32') {
      try {
        await fs.access(ffmpegPath);
        onLog(`[bootstrap] ffmpeg already exists at ${ffmpegPath}`);
      } catch {
        onLog('[bootstrap] ffmpeg missing. Starting automatic download (this may take a while)...');
        // Use PowerShell script to download and unzip
        const zipUrl = "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";
        const tempZip = path.join(binDir, 'ffmpeg.zip');
        const tempDir = path.join(binDir, 'ffmpeg-temp');

        const { exec } = await import('node:child_process');

        // PowerShell command to download and unzip
        const psCommand = `
          $ProgressPreference = 'SilentlyContinue';
          Invoke-WebRequest -Uri "${zipUrl}" -OutFile "${tempZip}";
          Expand-Archive -Path "${tempZip}" -DestinationPath "${tempDir}" -Force;
          Move-Item -Path "${tempDir}\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe" -Destination "${binDir}";
          Move-Item -Path "${tempDir}\\ffmpeg-master-latest-win64-gpl\\bin\\ffprobe.exe" -Destination "${binDir}";
          Remove-Item -Path "${tempZip}" -Force;
          Remove-Item -Path "${tempDir}" -Recurse -Force;
        `;

        await new Promise((resolve, reject) => {
          exec(`powershell -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
            if (error) {
              reject(new Error(`FFmpeg download failed: ${stderr || error.message}`));
            } else {
              resolve();
            }
          });
        });

        onLog('[bootstrap] ffmpeg downloaded and installed successfully.');
      }
    }

    return true;
  } catch (error) {
    onLog(`[bootstrap] Critical error: ${error.message}`);
    return false;
  }
};

const resolveDestination = (destination) => {
  if (!destination || typeof destination !== 'string') {
    return app.getPath('downloads');
  }
  if (path.isAbsolute(destination)) return destination;
  const base = app.getPath('downloads');
  return path.resolve(base, destination);
};

export const getYtDlpVersion = async () => {
  const ytDlpExecutable = await getExecutablePath();

  return new Promise((resolve, reject) => {
    const child = spawn(ytDlpExecutable, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`yt-dlp --version exited with code ${code}`));
      }
    });
    child.on('error', (err) => {
      reject(err);
    });
  });
};

export const updateYtDlp = async (onLog) => {
  const ytDlpExecutable = await getExecutablePath();
  const args = ['--update'];

  return new Promise((resolve, reject) => {
    onLog(`[yt-dlp] Updating: ${ytDlpExecutable} ${args.join(' ')}`);
    const child = spawn(ytDlpExecutable, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout.on('data', (data) => {
      onLog(`[yt-dlp] ${data.toString().trim()}`);
    });

    child.stderr.on('data', (data) => {
      onLog(`[yt-dlp] Error: ${data.toString().trim()}`);
    });

    child.on('close', (code) => {
      if (code === 0) {
        onLog('[yt-dlp] Update successful.');
        resolve(true);
      } else {
        onLog(`[yt-dlp] Update failed with code ${code}`);
        reject(new Error(`Update failed with code ${code}`));
      }
    });

    child.on('error', (err) => {
      onLog(`[yt-dlp] Failed to start update: ${err.message}`);
      reject(err);
    });
  });
};

export const getVideoMetadata = async (url) => {
  const ytDlpExecutable = await getExecutablePath();
  const args = ['--dump-json', '--no-playlist', url];

  // Try to avoid JS runtime warning if node is available
  if (process.env.PATH?.includes('node') || process.env.PATH?.includes('Node')) {
    args.push('--js-runtime', 'node');
  }

  return new Promise((resolve, reject) => {
    const child = spawn(ytDlpExecutable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const json = JSON.parse(output);
          resolve(json);
        } catch (e) {
          reject(new Error('Failed to parse yt-dlp output'));
        }
      } else {
        // Provide more specific error messages based on error output
        const errorLower = errorOutput.toLowerCase();

        if (errorLower.includes('unsupported url') || errorLower.includes('no suitable extractor')) {
          reject(new Error('Unsupported URL: This site is not supported by yt-dlp'));
        } else if (errorLower.includes('video unavailable') || errorLower.includes('this video is unavailable')) {
          reject(new Error('Video unavailable: This video cannot be accessed'));
        } else if (errorLower.includes('private video') || errorLower.includes('members-only')) {
          reject(new Error('Private video: This video is private or members-only'));
        } else if (errorLower.includes('http error') || errorLower.includes('unable to download')) {
          reject(new Error('Network error: Unable to fetch video information'));
        } else if (errorLower.includes('sign in') || errorLower.includes('login required')) {
          reject(new Error('Authentication required: This video requires login'));
        } else if (errorOutput.trim()) {
          // Return the actual error message if it's informative
          reject(new Error(errorOutput.split('\n')[0] || `yt-dlp exited with code ${code}`));
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
};

export const getPlaylistMetadata = async (url) => {
  const ytDlpExecutable = await getExecutablePath();
  const args = ['--dump-single-json', '--flat-playlist', '--yes-playlist', url];

  if (process.env.PATH?.includes('node') || process.env.PATH?.includes('Node')) {
    args.push('--js-runtime', 'node');
  }

  return new Promise((resolve, reject) => {
    const child = spawn(ytDlpExecutable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const json = JSON.parse(output);
          resolve(json);
        } catch (e) {
          reject(new Error('Failed to parse yt-dlp output'));
        }
      } else {
        // Provide more specific error messages based on error output
        const errorLower = errorOutput.toLowerCase();

        if (errorLower.includes('unsupported url') || errorLower.includes('no suitable extractor')) {
          reject(new Error('Unsupported URL: This playlist site is not supported'));
        } else if (errorLower.includes('playlist unavailable') || errorLower.includes('playlist does not exist')) {
          reject(new Error('Playlist unavailable: This playlist cannot be accessed'));
        } else if (errorLower.includes('private') || errorLower.includes('members-only')) {
          reject(new Error('Private playlist: This playlist is private or members-only'));
        } else if (errorOutput.trim()) {
          reject(new Error(errorOutput.split('\n')[0] || `yt-dlp exited with code ${code}`));
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
};

export const runYtDlp = async ({ url, referer, destination, filename, format, resolution, extraArgs, sponsorBlock, sponsorBlockCategories }, onProgress, onLog, onCreated) => {
  const resolvedDest = resolveDestination(destination);
  await fs.mkdir(resolvedDest, { recursive: true });

  // If filename doesn't have a template/extension, append %(ext)s
  // We check for %(ext)s specifically because titles often contain dots.
  // Also trim trailing dots which are problematic on Windows.
  let sanitizedFilename = filename.replace(/\.+$/, '');
  const finalFilename = sanitizedFilename.includes('%(ext)s') ? sanitizedFilename : `${sanitizedFilename}.%(ext)s`;
  const outputPathTemplate = path.join(resolvedDest, finalFilename);

  const args = [
    url,
    '--output', outputPathTemplate,
    '--newline',
  ];

  if (process.env.PATH?.includes('node') || process.env.PATH?.includes('Node')) {
    args.push('--js-runtime', 'node');
  }

  if (format === 'mp3') {
    args.push('--extract-audio', '--audio-format', 'mp3');
  } else if (format && format !== 'best') {
    // If specific format is requested, try to get that extension
    args.push('-f', `bestvideo[ext=${format}]+bestaudio[ext=m4a]/best[ext=${format}]/best`);
  }

  if (resolution && resolution !== 'best') {
    const resValue = resolution.replace('p', '');
    args.push('-S', `res:${resValue}`);
  }

  if (referer) {
    args.push('--add-header', `Referer:${referer}`);
  }

  if (extraArgs) {
    // Split by spaces but respect quoted sections
    const extraParts = extraArgs.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    args.push(...extraParts);
  }

  if (sponsorBlock && sponsorBlockCategories && sponsorBlockCategories.length > 0) {
    const categoriesToRemove = sponsorBlockCategories.filter(c => c !== 'poi_highlight');
    if (categoriesToRemove.length > 0) {
      args.push('--sponsorblock-remove', categoriesToRemove.join(','));
    }
  }

  const ytDlpExecutable = await getExecutablePath();

  return new Promise((resolve, reject) => {
    onLog(`[yt-dlp] Starting: ${ytDlpExecutable} ${args.join(' ')}`);

    const child = spawn(ytDlpExecutable, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    if (onCreated) onCreated(child);

    let lastProgress = null;

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        onLog(`[yt-dlp] ${line}`);

        // Progress parsing (yt-dlp formats vary, can include "~" and "(frag x/y)")
        if (line.includes('[download]')) {
          const percentMatch = line.match(/\[download\][^\d]*([\d.]+)%/);
          if (percentMatch) {
            const percent = parseFloat(percentMatch[1]);
            if (!Number.isNaN(percent)) {
              onProgress(Math.min(percent, 100));
              lastProgress = percent;
            }
          }
        }
      }
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        onLog(`[yt-dlp] ${line}`);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        onProgress(100);
        onLog('[yt-dlp] Download finished successfully.');
        resolve(child);
      } else {
        onLog(`[yt-dlp] Process exited with code ${code}`);
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      onLog(`[yt-dlp] Failed to start yt-dlp: ${err.message}`);
      reject(err);
    });
  });
};
