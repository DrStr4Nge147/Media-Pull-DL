import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ViewMode, DownloadItem, DownloadStatus, AppSettings, Preset, DownloadStrategy } from './types';
import DownloadForm from './components/DownloadForm';
import QueueList from './components/QueueList';
import ActivityLog from './components/ActivityLog';
import HistoryPage from './components/HistoryPage';
import SettingsModal from './components/SettingsModal';
import ConfirmationModal from './components/ConfirmationModal';
import { v4 as uuidv4 } from 'uuid';


const DEFAULT_SETTINGS: AppSettings = {
  defaultDestination: './Media-Pull DL',
  defaultFilenameFormat: '%(title)s.%(ext)s',
  defaultArgs: '--format mp4/best',
  presets: [
    { id: '1', name: 'High Quality Video', args: '-f "bestvideo+bestaudio/best"' },
    { id: '2', name: 'Audio Only (MP3)', args: '-x --audio-format mp3' },
    { id: '3', name: 'Low Res (480p)', args: '-S "res:480"' }
  ],
  theme: 'dark',
  autoUpdateCore: true
};

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const [queue, setQueue] = useState<DownloadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [downloadStrategy, setDownloadStrategy] = useState<DownloadStrategy>('SEQUENTIAL');
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('yt_dlp_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        // Merge with defaults to ensure new fields (like autoUpdateCore) exist
        const merged = { ...DEFAULT_SETTINGS, ...parsed };

        // Migration: Update default destination from old './YT-DLP' to new './Media-Pull DL'
        if (merged.defaultDestination === './YT-DLP') {
          merged.defaultDestination = './Media-Pull DL';
          localStorage.setItem('yt_dlp_settings', JSON.stringify(merged));
        }
        return merged;
      } catch (e) {
        console.error('Failed to parse settings:', e);
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [sharedDestination, setSharedDestination] = useState(settings.defaultDestination);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ current: string; latest: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateLogs, setUpdateLogs] = useState<string[]>([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [coreUpdateProgress, setCoreUpdateProgress] = useState<number | null>(null);
  const [coreUpdateError, setCoreUpdateError] = useState<string | null>(null);
  const [history, setHistory] = useState<DownloadItem[]>(() => {
    const saved = localStorage.getItem('yt_dlp_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [appVersion, setAppVersion] = useState<string>('0.0.0');
  const [appUpdateInfo, setAppUpdateInfo] = useState<{ current: string; latest: string; url: string; downloadUrl?: string; assetName?: string; isPortable?: boolean } | null>(null);
  const [showAppUpdateModal, setShowAppUpdateModal] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [appUpdateProgress, setAppUpdateProgress] = useState<number | null>(null);
  const [appDownloadedPath, setAppDownloadedPath] = useState<string | null>(null);
  const [isDownloadingApp, setIsDownloadingApp] = useState(false);
  const [appDownloadError, setAppDownloadError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => { }
  });
  const [showExitConfirm, setShowExitConfirm] = useState(false);


  // Update detection
  useEffect(() => {
    const w = window as any;

    // Initial version fetch
    if (typeof w.getYtDlpVersion === 'function') {
      w.getYtDlpVersion().then((v: string) => setCurrentVersion(v)).catch(() => { });
    }
    if (typeof w.getAppVersion === 'function') {
      w.getAppVersion().then((v: string) => {
        setAppVersion(v);
        document.title = `Media-Pull DL v${v}`;
        // Trigger manual check after version is loaded
        if (typeof w.checkAppUpdate === 'function') {
          w.checkAppUpdate();
        }
      });
    }

    if (typeof w.onYtDlpUpdateAvailable === 'function') {
      w.onYtDlpUpdateAvailable((data: { current: string; latest: string }) => {
        setUpdateInfo(data);
        setCurrentVersion(data.current);
        setUpdateSuccess(null);
      });
    }
    if (typeof w.onYtDlpUpToDate === 'function') {
      w.onYtDlpUpToDate((version: string) => {
        setUpdateSuccess(version);
        setCurrentVersion(version);
        setUpdateInfo(null);
        setCoreUpdateError(null);
        // Automatically hide notification banner after 5s
        setTimeout(() => setUpdateSuccess(null), 5000);
      });
    }

    if (typeof w.onYtDlpUpdateError === 'function') {
      w.onYtDlpUpdateError((error: string) => {
        setCoreUpdateError(error);
        setUpdateInfo(null);
        // Hide error after 10s
        setTimeout(() => setCoreUpdateError(null), 10000);
      });
    }

    // Trigger update check manually just in case
    if (typeof w.checkYtDlpUpdate === 'function') {
      w.checkYtDlpUpdate();
    }

    if (typeof w.onYtDlpProgress === 'function') {
      w.onYtDlpProgress((data: { id: string; progress: number }) => {
        setQueue(prev => prev.map(item => item.id === data.id ? { ...item, progress: data.progress } : item));
      });
    }
    if (typeof w.onYtDlpLog === 'function') {
      w.onYtDlpLog((data: { id: string; log: string }) => {
        const isProgressLine = data.log.includes('[download]');
        setQueue(prev => prev.map(item => {
          if (item.id !== data.id) return item;
          if (!isProgressLine) return { ...item, logs: [...item.logs, data.log] };

          const lastIdx = item.logs.length - 1;
          if (lastIdx >= 0 && item.logs[lastIdx]?.includes('[download]')) {
            const nextLogs = item.logs.slice();
            nextLogs[lastIdx] = data.log;
            return { ...item, logs: nextLogs };
          }
          return { ...item, logs: [...item.logs, data.log] };
        }));
      });
    }

    if (typeof w.onAppUpdateAvailable === 'function') {
      w.onAppUpdateAvailable((data: { current: string; latest: string; url: string; downloadUrl?: string; assetName?: string; isPortable?: boolean }) => {
        setAppUpdateInfo(data);
        setShowAppUpdateModal(true);
      });
    }

    if (typeof w.onAppUpdateProgress === 'function') {
      w.onAppUpdateProgress((progress: number) => {
        setAppUpdateProgress(progress);
      });
    }

    if (typeof w.onYtDlpUpdateProgress === 'function') {
      w.onYtDlpUpdateProgress((progress: number) => {
        setCoreUpdateProgress(progress);
      });
    }

    if (w.windowControls && w.windowControls.onMaximizedStatus) {
      w.windowControls.onMaximizedStatus((status: boolean) => {
        setIsMaximized(status);
      });
    }


    return () => {
      if (typeof w.removeUpdateListeners === 'function') w.removeUpdateListeners();
      if (typeof w.removeAllYtDlpListeners === 'function') w.removeAllYtDlpListeners();
    };
  }, []);

  useEffect(() => {
    if (updateInfo && settings.autoUpdateCore && !isUpdating) {
      handleUpdate(true);
    }
  }, [updateInfo, settings.autoUpdateCore]);

  const handleUpdate = async (silent = false) => {
    setIsUpdating(true);
    if (!silent) {
      setShowUpdateModal(true);
    }
    setUpdateLogs(['[System] Starting update...']);
    setCoreUpdateProgress(0);

    const w = window as any;
    w.onYtDlpUpdateLog((log: string) => {
      setUpdateLogs(prev => [...prev, log]);
    });

    try {
      const result = await w.updateYtDlp();
      if (result.success) {
        setUpdateLogs(prev => [...prev, '[System] Update completed successfully!']);
        setUpdateSuccess(result.version);
        setCurrentVersion(result.version);
        setUpdateInfo(null);

        if (!silent) {
          setTimeout(() => {
            setShowUpdateModal(false);
            // Keep success message for 5 seconds
            setTimeout(() => setUpdateSuccess(null), 5000);
          }, 1500);
        } else {
          // In silent mode, just show the success toast
          setTimeout(() => setUpdateSuccess(null), 5000);
        }
      } else {
        setUpdateLogs(prev => [...prev, `[Error] Update failed: ${result.error}`]);
        // If silent update failed, maybe show the modal now so the user can see why?
        if (silent) setShowUpdateModal(true);
      }
    } catch (e) {
      setUpdateLogs(prev => [...prev, `[Error] ${e instanceof Error ? e.message : String(e)}`]);
      if (silent) setShowUpdateModal(true);
    } finally {
      setIsUpdating(false);
      setCoreUpdateProgress(null);
    }
  };

  const handleInstallAppUpdate = async () => {
    if (appDownloadedPath) {
      const w = window as any;
      if (typeof w.quitAndInstall === 'function') {
        w.quitAndInstall(appDownloadedPath);
      }
      return;
    }

    const downloadUrl = appUpdateInfo?.downloadUrl;
    const assetName = appUpdateInfo?.assetName || 'Media-Pull-DL-Update.exe';

    if (!downloadUrl) {
      const urlToOpen = appUpdateInfo?.url;
      const w = window as any;
      if (urlToOpen) {
        if (typeof w.openExternal === 'function') {
          w.openExternal(urlToOpen);
        } else {
          window.open(urlToOpen, '_blank');
        }
      }
      setShowAppUpdateModal(false);
      return;
    }

    setIsDownloadingApp(true);
    setAppDownloadError(null);
    setAppUpdateProgress(0);

    const w = window as any;
    try {
      if (typeof w.downloadAppUpdate === 'function') {
        const result = await w.downloadAppUpdate(downloadUrl, assetName);
        if (result.success) {
          setAppDownloadedPath(result.path);
        } else {
          setAppDownloadError(result.error);
        }
      }
    } catch (e) {
      setAppDownloadError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsDownloadingApp(false);
      setAppUpdateProgress(null);
    }
  };

  const openDownloadFolder = useCallback(async () => {
    const destination = settings.defaultDestination;

    const w = window as any;
    try {
      if (typeof w.openDownloadFolder === 'function') {
        await w.openDownloadFolder(destination);
        return;
      }
      if (typeof w.__openDownloadFolder === 'function') {
        await w.__openDownloadFolder(destination);
        return;
      }
    } catch {
      // fall through to browser fallback
    }

    try {
      await navigator.clipboard.writeText(destination);
      window.alert(`Download folder path copied to clipboard:\n\n${destination}\n\nThis app is running in a browser, so it cannot open folders directly.`);
    } catch {
      window.alert(`Download folder:\n\n${destination}\n\nThis app is running in a browser, so it cannot open folders directly.`);
    }
  }, [settings.defaultDestination]);

  // Theme management
  useEffect(() => {
    const w = window as any;
    const isDark = settings.theme === 'dark';

    console.log(`[Theme] Switching to ${settings.theme}, Bridge available: ${!!w.windowControls?.setBackgroundColor}`);

    if (isDark) {
      document.documentElement.classList.add('dark');
      if (w.windowControls?.setBackgroundColor) {
        w.windowControls.setBackgroundColor('#020617'); // slate-950
      }
    } else {
      document.documentElement.classList.remove('dark');
      if (w.windowControls?.setBackgroundColor) {
        w.windowControls.setBackgroundColor('#f8fafc'); // slate-50
      }
    }
    localStorage.setItem('yt_dlp_settings', JSON.stringify(settings));
  }, [settings]);

  // Sync shared destination when settings change
  useEffect(() => {
    setSharedDestination(settings.defaultDestination);
  }, [settings.defaultDestination]);

  // History persistence
  useEffect(() => {
    localStorage.setItem('yt_dlp_history', JSON.stringify(history));
  }, [history]);

  const addToQueue = (itemData: Omit<DownloadItem, 'id' | 'status' | 'progress' | 'logs' | 'timestamp'>) => {
    const isDuplicate = queue.some(i => i.url === itemData.url) || history.some(i => i.url === itemData.url);
    if (isDuplicate && viewMode !== 'SINGLE') {
      console.log('Skipping duplicate URL:', itemData.url);
      return;
    }

    const newItem: DownloadItem = {
      ...itemData,
      id: uuidv4(),
      status: DownloadStatus.PENDING,
      progress: 0,
      logs: [`[System] Added to queue at ${new Date().toLocaleTimeString()}`],
      timestamp: Date.now(),
      noPlaylist: viewMode === 'SINGLE'
    };
    setQueue(prev => [...prev, newItem]);

    if (viewMode === 'SINGLE') {
      startBatchDownload([...queue, newItem]);
    }
  };

  const addMultipleToQueue = (itemsData: Omit<DownloadItem, 'id' | 'status' | 'progress' | 'logs' | 'timestamp'>[]) => {
    const existingUrls = new Set([...queue.map(i => i.url), ...history.map(i => i.url)]);
    const uniqueNewItemsSelection = itemsData.filter(item => !existingUrls.has(item.url));

    const newItems: DownloadItem[] = uniqueNewItemsSelection.map(itemData => ({
      ...itemData,
      id: uuidv4(),
      status: DownloadStatus.PENDING,
      progress: 0,
      logs: [`[System] Added to queue at ${new Date().toLocaleTimeString()}`],
      timestamp: Date.now(),
      noPlaylist: true
    }));
    setQueue(prev => [...prev, ...newItems]);
  };

  const startBatchDownload = async (currentQueue: DownloadItem[]) => {
    if (isProcessing) return;
    setIsProcessing(true);

    if (downloadStrategy === 'SEQUENTIAL' || viewMode === 'SINGLE') {
      await startSequentialDownload(currentQueue);
    } else {
      await startSimultaneousDownload(currentQueue);
    }
  };

  const startSimultaneousDownload = async (currentQueue: DownloadItem[]) => {
    const pendingItems = currentQueue.filter(item =>
      item.status !== DownloadStatus.COMPLETED &&
      item.status !== DownloadStatus.FAILED &&
      item.status !== DownloadStatus.PAUSED
    );

    if (pendingItems.length === 0) {
      setIsProcessing(false);
      return;
    }

    const downloadPromises = pendingItems.map(async (item) => {
      updateItemStatus(item.id, DownloadStatus.DOWNLOADING);
      try {
        await realYtDlpDownload(item);
        updateItemStatus(item.id, DownloadStatus.COMPLETED);
        setHistory(prev => [{ ...item, status: DownloadStatus.COMPLETED, timestamp: Date.now() }, ...prev]);
        // Send notification
        const w = window as any;
        if (typeof w.sendNotification === 'function') {
          w.sendNotification('Download Complete', `Successfully downloaded: ${item.filename}`);
        }
      } catch (e) {
        updateItemLogsSmart(item.id, `[Error] ${e instanceof Error ? e.message : String(e)}`);
        updateItemStatus(item.id, DownloadStatus.FAILED);
        setHistory(prev => [{ ...item, status: DownloadStatus.FAILED, timestamp: Date.now() }, ...prev]);
        // Send notification
        const w = window as any;
        if (typeof w.sendNotification === 'function') {
          w.sendNotification('Download Failed', `Failed to download: ${item.filename}`);
        }
      }
    });

    await Promise.all(downloadPromises);
    setIsProcessing(false);
  };

  const startSequentialDownload = async (currentQueue: DownloadItem[]) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const processNext = async (index: number) => {
      if (index >= currentQueue.length) {
        setIsProcessing(false);
        setCurrentIndex(-1);
        return;
      }

      const item = currentQueue[index];
      if (item.status === DownloadStatus.COMPLETED || item.status === DownloadStatus.FAILED) {
        processNext(index + 1);
        return;
      }

      if (item.status === DownloadStatus.PAUSED) {
        // Stop processing until resumed
        setIsProcessing(false);
        return;
      }

      setCurrentIndex(index);
      if (viewMode === 'SINGLE') {
        setSelectedItemId(item.id);
      }
      updateItemStatus(item.id, DownloadStatus.DOWNLOADING);

      // Real yt-dlp execution
      try {
        await realYtDlpDownload(item);
        updateItemStatus(item.id, DownloadStatus.COMPLETED);
        // Add to history
        setHistory(prev => [{ ...item, status: DownloadStatus.COMPLETED, timestamp: Date.now() }, ...prev]);
        // Send notification
        const w = window as any;
        if (typeof w.sendNotification === 'function') {
          w.sendNotification('Download Complete', `Successfully downloaded: ${item.filename}`);
        }
        // Continue to next item
        processNext(index + 1);
      } catch (e) {
        updateItemLogsSmart(item.id, `[Error] ${e instanceof Error ? e.message : String(e)}`);
        updateItemStatus(item.id, DownloadStatus.FAILED);
        // Add to history even on failure
        setHistory(prev => [{ ...item, status: DownloadStatus.FAILED, timestamp: Date.now() }, ...prev]);
        // Send notification
        const w = window as any;
        if (typeof w.sendNotification === 'function') {
          w.sendNotification('Download Failed', `Failed to download: ${item.filename}`);
        }
        // Continue to next item on failure
        processNext(index + 1);
      }
    };

    processNext(0);
  };

  const realYtDlpDownload = async (item: DownloadItem) => {
    const w = window as any;
    if (typeof w.runYtDlp !== 'function') {
      throw new Error('yt-dlp runner not available (not running in Electron?)');
    }

    const success = await w.runYtDlp({ ...item, id: item.id });
    if (!success) {
      throw new Error('Download process failed. Check the terminal for details.');
    }
  };

  const updateItemStatus = (id: string, status: DownloadStatus) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, status } : item));
  };

  const updateItemProgress = (id: string, progress: number) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, progress } : item));
  };

  const updateItemLogs = (id: string, log: string) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, logs: [...item.logs, log] } : item));
  };

  const updateItemLogsSmart = (id: string, log: string) => {
    const isProgressLine = log.includes('[download]');
    setQueue(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (!isProgressLine) return { ...item, logs: [...item.logs, log] };

      const lastIdx = item.logs.length - 1;
      if (lastIdx >= 0 && item.logs[lastIdx]?.includes('[download]')) {
        const nextLogs = item.logs.slice();
        nextLogs[lastIdx] = log;
        return { ...item, logs: nextLogs };
      }
      return { ...item, logs: [...item.logs, log] };
    }));
  };

  const pauseDownload = async (id: string) => {
    const w = window as any;
    try {
      const ok = await w.pauseDownload(id);
      if (ok) {
        updateItemStatus(id, DownloadStatus.PAUSED);
        updateItemLogsSmart(id, '[System] Download paused.');
      }
    } catch (e) {
      updateItemLogsSmart(id, `[Error] Failed to pause: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const resumeDownload = async (id: string) => {
    const w = window as any;
    try {
      const ok = await w.resumeDownload(id);
      if (ok) {
        updateItemStatus(id, DownloadStatus.DOWNLOADING);
        updateItemLogsSmart(id, '[System] Download resumed.');
        // Continue sequential processing
        const index = queue.findIndex(item => item.id === id);
        if (index !== -1) {
          setIsProcessing(true);
          setCurrentIndex(index);
          // The resumed process will emit progress and complete; when done, processNext will advance
        }
      }
    } catch (e) {
      updateItemLogsSmart(id, `[Error] Failed to resume: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const stopDownload = async (id: string) => {
    const w = window as any;
    try {
      const ok = await w.stopDownload(id);
      if (ok) {
        updateItemStatus(id, DownloadStatus.FAILED);
        updateItemLogsSmart(id, '[System] Download stopped by user.');
      }
    } catch (e) {
      updateItemLogsSmart(id, `[Error] Failed to stop: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearQueue = () => {
    setShowConfirmModal({
      show: true,
      title: 'Clear Batch List?',
      message: 'Are you sure you want to remove all items from the current batch list? This action cannot be undone.',
      onConfirm: () => {
        setQueue([]);
        setIsProcessing(false);
        setCurrentIndex(-1);
        setShowConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };


  const resetView = () => {
    if (isProcessing) {
      setShowConfirmModal({
        show: true,
        title: 'Exit Progress?',
        message: 'A download is currently in progress. Exiting to the menu will stop monitoring this session. Continue?',
        onConfirm: () => {
          setViewMode(null);
          setIsProcessing(false);
          setCurrentIndex(-1);
          setShowConfirmModal(prev => ({ ...prev, show: false }));
        }
      });
      return;
    }
    setViewMode(null);
    setIsProcessing(false);
    setCurrentIndex(-1);
  };

  const getActiveActivity = useCallback(() => {
    const activeDownloads = queue.filter(i => i.status === DownloadStatus.DOWNLOADING).length;
    const pendingDownloads = queue.filter(i => i.status === DownloadStatus.PENDING).length;

    const activities = [];
    if (activeDownloads > 0) activities.push(`${activeDownloads} active download${activeDownloads > 1 ? 's' : ''}`);
    if (isProcessing && pendingDownloads > 0) activities.push(`${pendingDownloads} item${pendingDownloads > 1 ? 's' : ''} in queue`);
    if (isUpdating) activities.push('Core engine update in progress');
    if (isDownloadingApp) activities.push('App update download in progress');

    return activities;
  }, [queue, isProcessing, isUpdating, isDownloadingApp]);

  const handleCloseAttempt = useCallback(() => {
    const activities = getActiveActivity();
    if (activities.length > 0) {
      setShowExitConfirm(true);
    } else {
      const w = window as any;
      if (w.appForceQuit) {
        w.appForceQuit();
      } else {
        w.windowControls?.close();
      }
    }
  }, [getActiveActivity]);

  useEffect(() => {
    const w = window as any;
    if (w.onCloseRequested) {
      w.onCloseRequested(() => {
        handleCloseAttempt();
      });
    }
  }, [handleCloseAttempt]);


  const totalItems = queue.length;
  const completedItems = queue.filter(i => i.status === DownloadStatus.COMPLETED).length;

  return (
    <div className="h-full flex flex-col w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="flex justify-end h-8 md:h-10 shrink-0 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="flex items-stretch" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={() => (window as any).minimizeToTray()}
            className="w-10 md:w-12 h-full flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Minimize to Tray"
          >
            <i className="fa-solid fa-inbox text-xs"></i>
          </button>
          <button
            onClick={() => (window as any).windowControls?.minimize()}
            className="w-10 md:w-12 h-full flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Minimize"
          >
            <i className="fa-solid fa-minus text-[10px]"></i>
          </button>
          <button
            onClick={() => (window as any).windowControls?.maximize()}
            className="w-10 md:w-12 h-full flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <i className="fa-regular fa-clone text-[10px]"></i>
            ) : (
              <i className="fa-regular fa-square text-[10px]"></i>
            )}
          </button>
          <button
            onClick={handleCloseAttempt}
            className="w-11 md:w-12 h-full flex items-center justify-center text-slate-500 hover:bg-red-600 hover:text-white transition-colors"
            title="Close"
          >
            <i className="fa-solid fa-xmark text-base"></i>
          </button>
        </div>
      </div>
      <div className="flex-1 flex flex-col p-4 pt-0 md:p-8 md:pt-0 lg:p-10 lg:pt-0 xl:p-12 xl:pt-0 overflow-hidden">
        {/* App Update Modal */}
        {showAppUpdateModal && appUpdateInfo && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/40 dark:bg-slate-950/90 backdrop-blur-sm"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <div className="bg-white dark:bg-slate-800 border-2 border-purple-500/30 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl dark:shadow-purple-900/50 animate-fadeIn">
              <div className="p-8 text-center">
                <div className="bg-purple-600/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-purple-500/50 shadow-lg shadow-purple-900/30">
                  <i className="fa-solid fa-rocket text-4xl text-purple-400 animate-pulse"></i>
                </div>
                <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                  New Version Available!
                </h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                  A new version of <span className="font-bold text-purple-600 dark:text-purple-400">Media-Pull DL</span> is ready.
                  <span className="block mt-2 text-xs text-slate-500 italic">Updating to the latest version ensures better download efficiency, improved stability, and access to new features.</span>
                </p>

                <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-4 mb-6 border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Current Version</span>
                    <span className="text-sm font-mono text-slate-600 dark:text-slate-400">{appUpdateInfo.current}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wider font-bold">Latest Version</span>
                    <span className="text-sm font-mono text-purple-600 dark:text-purple-400 font-bold">{appUpdateInfo.latest}</span>
                  </div>

                </div>

                {isDownloadingApp && (
                  <div className="mb-6 animate-fadeIn">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">Downloading...</span>
                      <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">{Math.round(appUpdateProgress || 0)}%</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-300 shadow-sm shadow-purple-500/50"
                        style={{ width: `${appUpdateProgress || 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {appDownloadError && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold flex items-center gap-3 animate-fadeIn">
                    <i className="fa-solid fa-circle-exclamation text-lg"></i>
                    <span className="text-left">{appDownloadError}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    disabled={isDownloadingApp}
                    onClick={() => setShowAppUpdateModal(false)}
                    className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${isDownloadingApp ? 'opacity-50 cursor-not-allowed' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300'}`}
                  >
                    <i className="fa-solid fa-clock mr-2"></i>
                    Later
                  </button>
                  <button
                    disabled={isDownloadingApp}
                    onClick={handleInstallAppUpdate}
                    className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${appDownloadedPath
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-900/40'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-900/40'
                      } ${isDownloadingApp ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isDownloadingApp ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        Downloading...
                      </>
                    ) : appDownloadedPath ? (
                      <>
                        <i className="fa-solid fa-circle-check"></i>
                        Install & Restart
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-cloud-arrow-down"></i>
                        Update Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showUpdateModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-md"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center text-slate-900 dark:text-white">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <i className="fa-solid fa-arrows-rotate text-blue-500 dark:text-blue-400 animate-spin-slow"></i>
                  Updating Core Engine
                </h3>
                {!isUpdating && (
                  <button
                    onClick={() => setShowUpdateModal(false)}
                    className="w-10 h-10 rounded-full hover:bg-slate-800 flex items-center justify-center transition-colors"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>
              <div className="p-6">
                <div className="bg-slate-950 p-4 rounded-xl font-mono text-sm h-64 overflow-y-auto border border-slate-800 shadow-inner select-text mb-4">
                  {updateLogs.map((log, i) => (
                    <div key={i} className={`mb-1 ${log.startsWith('[Error]') ? 'text-red-400' : log.startsWith('[System]') ? 'text-blue-400' : 'text-slate-300'}`}>
                      {log}
                    </div>
                  ))}
                </div>

                {coreUpdateProgress !== null && (
                  <div className="animate-fadeIn">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Update Progress</span>
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{Math.round(coreUpdateProgress)}%</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-300 shadow-sm shadow-blue-500/50"
                        style={{ width: `${coreUpdateProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                <button
                  disabled={isUpdating}
                  onClick={() => setShowUpdateModal(false)}
                  className={`px-6 py-2 rounded-xl font-bold transition-all ${isUpdating ? 'opacity-50 cursor-not-allowed text-slate-500' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-100'}`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <header
          className="w-full max-w-[1800px] mx-auto flex-shrink-0 flex justify-between items-center mb-4 md:mb-8 bg-white dark:bg-slate-800/50 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-700 backdrop-blur-sm shadow-sm dark:shadow-none transition-all overflow-hidden"
          style={{ WebkitAppRegion: 'drag' } as any}
        >
          <div className="flex items-center gap-4 cursor-pointer" onClick={resetView} style={{ WebkitAppRegion: 'no-drag' } as any}>
            <div className="bg-gradient-to-br from-red-600 to-red-500 p-3 rounded-2xl shadow-xl shadow-red-500/20 hover:rotate-6 transition-transform">
              <i className="fa-solid fa-cloud-arrow-down text-2xl text-white"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 md:gap-3 leading-none truncate">
                <h1 className="text-lg md:text-2xl font-black tracking-tighter text-slate-900 dark:text-white truncate">Media-Pull DL</h1>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[8px] md:text-[10px] font-bold uppercase tracking-widest mt-1 truncate">Simplistic Media Download Manager</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <button
              onClick={() => {
                const url = "https://github.com/DrStr4Nge147/Media-Pull-DL";
                const w = window as any;
                if (typeof w.openExternal === 'function') {
                  w.openExternal(url);
                } else {
                  window.open(url, '_blank');
                }
              }}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all font-bold text-xs md:text-sm border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none group"
            >
              <i className="fa-brands fa-github text-base md:text-lg group-hover:scale-110 transition-transform"></i>
              <span className="hidden sm:inline">GitHub</span>
            </button>
            {viewMode && (
              <button
                onClick={openDownloadFolder}
                className="bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 transition-all px-3 md:px-4 py-2 rounded-xl font-bold text-xs md:text-sm shadow-lg shadow-slate-900/10 dark:shadow-none whitespace-nowrap"
                title="Open download folder"
              >
                <i className="fa-solid fa-folder-open md:mr-2"></i>
                <span className="hidden md:inline">Open Folder</span>
              </button>
            )}
            {viewMode && (
              <button
                onClick={resetView}
                className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100 transition-all px-3 md:px-4 py-2 rounded-xl font-bold text-xs md:text-sm border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none whitespace-nowrap"
              >
                <span className="hidden md:inline">Switch Mode</span>
                <i className="fa-solid fa-repeat md:hidden"></i>
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none"
              title="Settings & Presets"
            >
              <i className="fa-solid fa-sliders"></i>
            </button>
          </div>
        </header>

        {!viewMode ? (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeIn overflow-y-auto no-scrollbar px-2 py-4">
            <div className="w-full max-w-6xl">
              <h2 className="text-xl md:text-5xl font-black mb-4 md:mb-12 text-center bg-gradient-to-br from-slate-900 via-slate-700 to-slate-400 dark:from-white dark:via-slate-200 dark:to-slate-500 bg-clip-text text-transparent tracking-tighter">Choose Your Workflow</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-8 w-full">
                <button
                  onClick={() => setViewMode('SINGLE')}
                  className="group p-4 sm:p-6 lg:p-10 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-[2rem] lg:rounded-[2.5rem] transition-all hover:scale-[1.02] active:scale-[0.98] transform-gpu text-left relative overflow-hidden flex flex-col no-underline shadow-2xl shadow-slate-200/60 dark:shadow-none"
                >
                  <div className="absolute -right-8 -top-8 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-[0.07] transition-opacity rotate-12">
                    <i className="fa-solid fa-bolt text-[15rem]"></i>
                  </div>
                  <div className="bg-blue-600 w-10 h-10 md:w-12 md:h-12 lg:w-16 lg:h-16 rounded-xl md:rounded-2xl lg:rounded-3xl flex items-center justify-center mb-2 md:mb-4 lg:mb-6 shadow-xl shadow-blue-500/30 dark:shadow-blue-900/40 group-hover:rotate-6 transition-transform">
                    <i className="fa-solid fa-bolt text-xl lg:text-2xl text-white"></i>
                  </div>
                  <h3 className="text-base md:text-lg lg:text-xl font-black mb-1 md:mb-3 text-slate-900 dark:text-white uppercase tracking-tight">Single Download</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] lg:text-sm leading-relaxed font-medium line-clamp-2 md:line-clamp-none">Fast, one-off downloads. Perfect for grabbing content quickly with custom options.</p>
                </button>

                <button
                  onClick={() => setViewMode('QUEUE')}
                  className="group p-4 sm:p-6 lg:p-10 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-[2rem] lg:rounded-[2.5rem] transition-all hover:scale-[1.02] active:scale-[0.98] transform-gpu text-left relative overflow-hidden flex flex-col no-underline shadow-2xl shadow-slate-200/60 dark:shadow-none"
                >
                  <div className="absolute -right-8 -top-8 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-[0.07] transition-opacity rotate-12">
                    <i className="fa-solid fa-list-check text-[15rem]"></i>
                  </div>
                  <div className="bg-purple-600 w-10 h-10 md:w-12 md:h-12 lg:w-16 lg:h-16 rounded-xl md:rounded-2xl lg:rounded-3xl flex items-center justify-center mb-2 md:mb-4 lg:mb-6 shadow-xl shadow-purple-500/30 dark:shadow-purple-900/40 group-hover:rotate-6 transition-transform">
                    <i className="fa-solid fa-list-check text-xl lg:text-2xl text-white"></i>
                  </div>
                  <h3 className="text-base md:text-lg lg:text-xl font-black mb-1 md:mb-3 text-slate-900 dark:text-white uppercase tracking-tight">Multiple Download</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] lg:text-sm leading-relaxed font-medium line-clamp-2 md:line-clamp-none">Build a list and download them sequentially or simultaneously. Ideal for playlists.</p>
                </button>

                <button
                  onClick={() => setViewMode('HISTORY')}
                  className="group p-4 sm:p-6 lg:p-10 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-[2rem] lg:rounded-[2.5rem] transition-all hover:scale-[1.02] active:scale-[0.98] transform-gpu text-left relative overflow-hidden flex flex-col no-underline shadow-2xl shadow-slate-200/60 dark:shadow-none"
                >
                  <div className="absolute -right-8 -top-8 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-[0.07] transition-opacity rotate-12">
                    <i className="fa-solid fa-clock-rotate-left text-[15rem]"></i>
                  </div>
                  <div className="bg-amber-600 w-10 h-10 md:w-12 md:h-12 lg:w-16 lg:h-16 rounded-xl md:rounded-2xl lg:rounded-3xl flex items-center justify-center mb-2 md:mb-4 lg:mb-6 shadow-xl shadow-amber-500/30 dark:shadow-amber-900/40 group-hover:rotate-6 transition-transform">
                    <i className="fa-solid fa-clock-rotate-left text-xl lg:text-2xl text-white"></i>
                  </div>
                  <h3 className="text-base md:text-lg lg:text-xl font-black mb-1 md:mb-3 text-slate-900 dark:text-white uppercase tracking-tight">History</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] lg:text-sm leading-relaxed font-medium line-clamp-2 md:line-clamp-none">Review past downloads, open folders, or clear logs from previous sessions.</p>
                </button>
              </div>
            </div>
          </div>
        ) : viewMode === 'HISTORY' ? (
          <HistoryPage
            history={history}
            onClear={() => {
              setShowConfirmModal({
                show: true,
                title: 'Clear History?',
                message: 'Are you sure you want to permanently delete your entire download history? This cannot be undone.',
                onConfirm: () => {
                  setHistory([]);
                  setShowConfirmModal(prev => ({ ...prev, show: false }));
                }
              });
            }}
            onRemove={(id) => setHistory(prev => prev.filter(i => i.id !== id))}
          />

        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10 overflow-hidden w-full max-w-[1800px] mx-auto">
            <div className="md:col-span-5 lg:col-span-4 xl:col-span-3 h-full flex flex-col space-y-6 overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                  <i className={`fa-solid ${viewMode === 'SINGLE' ? 'fa-bolt text-blue-500' : 'fa-list-check text-purple-500'}`}></i>
                  {viewMode === 'SINGLE' ? 'Quick Download' : 'Multiple Download'}
                </h3>
                <DownloadForm
                  onAdd={addToQueue}
                  onAddMultiple={addMultipleToQueue}
                  isProcessing={isProcessing || isUpdating}
                  mode={viewMode}
                  settings={settings}
                  sharedDestination={sharedDestination}
                  setSharedDestination={setSharedDestination}
                  onClear={() => setSelectedItemId(null)}
                />
              </div>

              {viewMode === 'QUEUE' && totalItems > 0 && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">Download Strategy</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                      onClick={() => setDownloadStrategy('SEQUENTIAL')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${downloadStrategy === 'SEQUENTIAL'
                        ? 'bg-blue-600/10 dark:bg-blue-600/20 border-blue-500 text-blue-600 dark:text-blue-400 shadow-lg shadow-blue-500/10'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400 dark:hover:border-slate-500'}`}
                    >
                      <i className="fa-solid fa-arrow-down-1-9 text-lg"></i>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Sequential</span>
                    </button>
                    <button
                      onClick={() => setDownloadStrategy('SIMULTANEOUS')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${downloadStrategy === 'SIMULTANEOUS'
                        ? 'bg-orange-600/10 dark:bg-orange-600/20 border-orange-500 text-orange-600 dark:text-orange-400 shadow-lg shadow-orange-500/10'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400 dark:hover:border-slate-500'}`}
                    >
                      <i className="fa-solid fa-arrows-down-to-line text-lg"></i>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Simultaneous</span>
                    </button>
                  </div>

                  <button
                    disabled={isProcessing || isUpdating || totalItems === 0}
                    onClick={() => startBatchDownload(queue)}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${isProcessing || isUpdating
                      ? 'bg-slate-700 cursor-not-allowed opacity-50'
                      : 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20 active:scale-95'
                      }`}
                  >
                    <i className="fa-solid fa-play"></i>
                    {isUpdating ? 'Updating...' : (isProcessing ? 'Processing...' : 'Start Download')}
                  </button>
                </div>
              )}
            </div>

            <div className="md:col-span-7 lg:col-span-8 xl:col-span-9 h-full flex flex-col space-y-6 overflow-hidden">
              {totalItems > 0 && (
                <div className="flex-1 min-h-0 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col shadow-sm dark:shadow-none">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                    <h3 className="font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <i className="fa-solid fa-layer-group text-slate-400"></i>
                      Batch List
                    </h3>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={clearQueue}
                        className="text-slate-400 hover:text-red-500 transition-colors text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-wider"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                        Clear
                      </button>
                      <div className="bg-white dark:bg-slate-900 px-3 py-1 rounded-full text-[10px] font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {completedItems} / {totalItems} DONE
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <QueueList
                      items={queue}
                      onRemove={removeFromQueue}
                      currentIndex={currentIndex}
                      onPause={pauseDownload}
                      onResume={resumeDownload}
                      onStop={stopDownload}
                      selectedId={selectedItemId}
                      onSelect={(id) => setSelectedItemId(prev => prev === id ? null : id)}
                    />
                  </div>
                </div>
              )}

              {selectedItemId && queue.find(i => i.id === selectedItemId) && (
                <ActivityLog item={queue.find(i => i.id === selectedItemId)!} />
              )}

              {totalItems === 0 && (
                <div className="flex-1 bg-white dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-700 p-10 md:p-20 rounded-3xl flex flex-col items-center justify-center text-center shadow-xl shadow-slate-200/50 dark:shadow-none animate-fadeIn translate-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800/20 w-24 h-24 rounded-[2rem] flex items-center justify-center mb-8 border border-slate-200 dark:border-slate-700 shadow-sm relative group hover:rotate-6 transition-transform">
                    <i className="fa-solid fa-hourglass-start text-4xl text-slate-300 dark:text-slate-600 animate-pulse-slow"></i>
                    <div className="absolute inset-0 bg-blue-500/5 rounded-[2rem] animate-ping opacity-20"></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-slate-300 tracking-tight mb-3 uppercase">Batch list is empty</h3>
                  <p className="text-slate-500 dark:text-slate-500 max-w-sm font-medium leading-relaxed">Fill out the form to the left to start adding your downloads and building your collection.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {showSettings && (
          <SettingsModal
            settings={settings}
            onSave={(newSettings) => {
              setSettings(newSettings);
              setSharedDestination(newSettings.defaultDestination);
              setSettingsSaved(true);
              setTimeout(() => setSettingsSaved(false), 3000);
            }}
            onClose={() => setShowSettings(false)}
          />
        )}

        {showConfirmModal.show && (
          <ConfirmationModal
            title={showConfirmModal.title}
            message={showConfirmModal.message}
            onConfirm={showConfirmModal.onConfirm}
            onCancel={() => setShowConfirmModal(prev => ({ ...prev, show: false }))}
          />
        )}

        <footer className="mt-auto py-2 flex flex-col items-center gap-2 text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black opacity-40 hover:opacity-80 transition-opacity">
          <p>Media-Pull DL • Simplistic Media Download Manager</p>
          <div className="flex items-center gap-4">
            <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">App v{appVersion}</span>
            {currentVersion && !isUpdating && (
              <span className="bg-emerald-500/5 text-emerald-600 dark:text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">Core v{currentVersion}</span>
            )}
            {isUpdating && (
              <div className="flex items-center gap-3 bg-blue-500/5 px-3 py-1 rounded-full border border-blue-500/20 animate-fadeIn">
                <i className="fa-solid fa-spinner fa-spin text-blue-500"></i>
                <span className="text-blue-600 dark:text-blue-400 font-bold">Updating...</span>
                {coreUpdateProgress !== null && (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${coreUpdateProgress}%` }}
                      ></div>
                    </div>
                    <span className="text-[9px] font-mono text-blue-500">{Math.round(coreUpdateProgress)}%</span>
                  </div>
                )}
              </div>
            )}
            {updateInfo && !isUpdating && (
              <button
                onClick={() => handleUpdate(false)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors flex items-center gap-1.5 animate-pulse"
                title={`Update available: ${updateInfo.latest}`}
              >
                <i className="fa-solid fa-arrows-rotate"></i>
                Update Core
              </button>
            )}
            {coreUpdateError && (
              <div
                className="text-amber-600 dark:text-amber-500 flex items-center gap-1.5 animate-fadeIn"
                title={coreUpdateError}
              >
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span className="max-w-[150px] truncate hidden sm:inline">Limit Exceeded</span>
              </div>
            )}
            {appUpdateInfo && (
              <button
                onClick={() => setShowAppUpdateModal(true)}
                className="text-purple-600 dark:text-purple-400 hover:text-purple-500 transition-colors flex items-center gap-1.5 animate-pulse"
              >
                <i className="fa-solid fa-circle-up"></i>
                Update Available
              </button>
            )}
          </div>
        </footer>

        {/* Up to date Toast */}
        {updateSuccess && (
          <div className="fixed bottom-8 right-8 z-[100] bg-white dark:bg-slate-900/90 backdrop-blur-md border border-emerald-500/50 px-6 py-4 rounded-2xl shadow-2xl dark:shadow-emerald-950/20 flex items-center gap-4 animate-slideInRight">
            <div className="bg-emerald-500/10 dark:bg-emerald-500/20 w-8 h-8 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-500">
              <i className="fa-solid fa-check"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">System Up to Date</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Running latest v{updateSuccess}</p>
            </div>
            <button
              onClick={() => setUpdateSuccess(null)}
              className="ml-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* Settings Saved Toast */}
        {settingsSaved && (
          <div className="fixed bottom-8 right-8 z-[100] bg-white dark:bg-slate-900/90 backdrop-blur-md border border-emerald-500/50 px-6 py-4 rounded-2xl shadow-2xl dark:shadow-emerald-950/20 flex items-center gap-4 animate-slideInRight">
            <div className="bg-emerald-500/10 dark:bg-emerald-500/20 w-10 h-10 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-500 shadow-sm">
              <i className="fa-solid fa-check-double rotate-3 group-hover:rotate-0 transition-transform"></i>
            </div>
            <div>
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 tracking-tight">Settings Applied</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] font-black">Preferences Synchronized</p>
            </div>
          </div>
        )}

        {/* Exit Confirmation Dialog */}
        {showExitConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/10 dark:bg-slate-950/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 w-[90%] max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl p-8 text-center animate-scaleIn">
              <div className="w-20 h-20 bg-amber-500/10 dark:bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500 border-2 border-amber-500/30">
                <i className="fa-solid fa-triangle-exclamation text-4xl"></i>
              </div>
              <h3 className="text-2xl font-black mb-4 text-slate-900 dark:text-white tracking-tight">Active Activity Detected</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed text-sm">
                The application is currently performing the following tasks:
                <ul className="mt-4 space-y-2 font-bold text-slate-800 dark:text-slate-200">
                  {getActiveActivity().map((a, i) => (
                    <li key={i} className="flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-950/50 py-2 px-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
                      {a}
                    </li>
                  ))}
                </ul>
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    (window as any).minimizeToTray();
                    setShowExitConfirm(false);
                  }}
                  className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-black hover:bg-slate-800 dark:hover:bg-slate-200 transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-tray"></i>
                  Minimize to Tray
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => (window as any).appForceQuit()}
                    className="py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 border border-red-500/30"
                  >
                    <i className="fa-solid fa-power-off"></i>
                    Exit Anyway
                  </button>
                  <button
                    onClick={() => setShowExitConfirm(false)}
                    className="py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-xmark"></i>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
