
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
  defaultDestination: './YT-DLP',
  defaultFilenameFormat: '%(title)s.%(ext)s',
  defaultArgs: '--format mp4/best',
  presets: [
    { id: '1', name: 'High Quality Video', args: '-f "bestvideo+bestaudio/best"' },
    { id: '2', name: 'Audio Only (MP3)', args: '-x --audio-format mp3' },
    { id: '3', name: 'Low Res (480p)', args: '-S "res:480"' }
  ],
  theme: 'dark'
};

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const [queue, setQueue] = useState<DownloadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [downloadStrategy, setDownloadStrategy] = useState<DownloadStrategy>('SEQUENTIAL');
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('yt_dlp_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
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
        // Automatically hide notification banner after 5s
        setTimeout(() => setUpdateSuccess(null), 5000);
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


    return () => {
      if (typeof w.removeUpdateListeners === 'function') w.removeUpdateListeners();
      if (typeof w.removeAllYtDlpListeners === 'function') w.removeAllYtDlpListeners();
    };
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    setShowUpdateModal(true);
    setUpdateLogs(['[System] Starting update...']);

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
        setTimeout(() => {
          setShowUpdateModal(false);
          // Keep success message for 5 seconds
          setTimeout(() => setUpdateSuccess(null), 5000);
        }, 1500);
      } else {
        setUpdateLogs(prev => [...prev, `[Error] Update failed: ${result.error}`]);
      }
    } catch (e) {
      setUpdateLogs(prev => [...prev, `[Error] ${e instanceof Error ? e.message : String(e)}`]);
    } finally {
      setIsUpdating(false);
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
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
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


  const totalItems = queue.length;
  const completedItems = queue.filter(i => i.status === DownloadStatus.COMPLETED).length;

  return (
    <div className="h-full flex flex-col w-full p-4 md:p-8 lg:p-10 xl:p-12 overflow-hidden select-none bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* App Update Modal */}
      {showAppUpdateModal && appUpdateInfo && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/40 dark:bg-slate-950/90 backdrop-blur-sm">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-md">
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
              <div className="bg-slate-950 p-4 rounded-xl font-mono text-sm h-64 overflow-y-auto border border-slate-800 shadow-inner select-text">
                {updateLogs.map((log, i) => (
                  <div key={i} className={`mb-1 ${log.startsWith('[Error]') ? 'text-red-400' : log.startsWith('[System]') ? 'text-blue-400' : 'text-slate-300'}`}>
                    {log}
                  </div>
                ))}
              </div>
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

      <header className="w-full max-w-[1800px] mx-auto flex-shrink-0 flex justify-between items-center mb-6 md:mb-10 bg-white dark:bg-slate-800/50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-700 backdrop-blur-sm shadow-sm dark:shadow-none transition-all overflow-hidden">
        <div className="flex items-center gap-4 cursor-pointer" onClick={resetView}>
          <div className="bg-gradient-to-br from-red-600 to-red-500 p-3 rounded-2xl shadow-xl shadow-red-500/20 hover:rotate-6 transition-transform">
            <i className="fa-solid fa-cloud-arrow-down text-2xl text-white"></i>
          </div>
          <div>
            <div className="flex items-center gap-2 md:gap-3 leading-none truncate">
              <h1 className="text-lg md:text-2xl font-black tracking-tighter text-slate-900 dark:text-white truncate">Media-Pull DL</h1>
              {currentVersion ? (
                <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                  <span className="text-[8px] md:text-[10px] uppercase tracking-widest px-2 md:px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 shadow-sm font-black flex items-center gap-1 md:gap-1.5 transition-all">
                    <span className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    v{currentVersion}
                  </span>

                  {appUpdateInfo && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAppUpdateModal(true);
                      }}
                      className="group/app-update relative text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-purple-500/30 bg-purple-500/5 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 shadow-sm font-black flex items-center gap-1.5 hover:bg-purple-500/10 dark:hover:bg-purple-500/30 transition-all animate-pulse-slow active:scale-95"
                    >
                      <i className="fa-solid fa-up-right-from-square"></i>
                      Update App
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 font-mono font-bold animate-pulse">
                  Checking...
                </span>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[8px] md:text-[10px] font-bold uppercase tracking-widest mt-1 truncate">Simplistic Media Download Manager</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button
            onClick={() => {
              const url = "https://github.com/DrStr4Nge147/Media-Pull-DL";
              if (typeof (window as any).openExternal === 'function') {
                (window as any).openExternal(url);
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
        <div className="flex-1 flex flex-col items-center justify-center animate-fadeIn overflow-y-auto overflow-x-hidden custom-scrollbar px-2">
          <div className="w-full max-w-6xl">
            <h2 className="text-3xl md:text-5xl font-black mb-12 text-center bg-gradient-to-br from-slate-900 via-slate-700 to-slate-400 dark:from-white dark:via-slate-200 dark:to-slate-500 bg-clip-text text-transparent tracking-tighter">Choose Your Workflow</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
              <button
                onClick={() => setViewMode('SINGLE')}
                className="group p-10 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-[2.5rem] transition-all hover:scale-[1.02] active:scale-[0.98] transform-gpu text-left relative overflow-hidden flex flex-col no-underline shadow-2xl shadow-slate-200/60 dark:shadow-none"
              >
                <div className="absolute -right-8 -top-8 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-[0.07] transition-opacity rotate-12">
                  <i className="fa-solid fa-bolt text-[15rem]"></i>
                </div>
                <div className="bg-blue-600 w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/30 dark:shadow-blue-900/40 group-hover:rotate-6 transition-transform">
                  <i className="fa-solid fa-bolt text-2xl text-white"></i>
                </div>
                <h3 className="text-xl font-black mb-3 text-slate-900 dark:text-white uppercase tracking-tight">Single Download</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed font-medium">Fast, one-off downloads. Perfect for grabbing content quickly with custom options.</p>
              </button>

              <button
                onClick={() => setViewMode('QUEUE')}
                className="group p-10 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-[2.5rem] transition-all hover:scale-[1.02] active:scale-[0.98] transform-gpu text-left relative overflow-hidden flex flex-col no-underline shadow-2xl shadow-slate-200/60 dark:shadow-none"
              >
                <div className="absolute -right-8 -top-8 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-[0.07] transition-opacity rotate-12">
                  <i className="fa-solid fa-list-check text-[15rem]"></i>
                </div>
                <div className="bg-purple-600 w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-purple-500/30 dark:shadow-purple-900/40 group-hover:rotate-6 transition-transform">
                  <i className="fa-solid fa-list-check text-2xl text-white"></i>
                </div>
                <h3 className="text-xl font-black mb-3 text-slate-900 dark:text-white uppercase tracking-tight">Multiple Download</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed font-medium">Build a list and download them sequentially or simultaneously. Ideal for playlists.</p>
              </button>

              <button
                onClick={() => setViewMode('HISTORY')}
                className="group p-10 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-[2.5rem] transition-all hover:scale-[1.02] active:scale-[0.98] transform-gpu text-left relative overflow-hidden flex flex-col no-underline shadow-2xl shadow-slate-200/60 dark:shadow-none"
              >
                <div className="absolute -right-8 -top-8 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-[0.07] transition-opacity rotate-12">
                  <i className="fa-solid fa-clock-rotate-left text-[15rem]"></i>
                </div>
                <div className="bg-amber-600 w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-amber-500/30 dark:shadow-amber-900/40 group-hover:rotate-6 transition-transform">
                  <i className="fa-solid fa-clock-rotate-left text-2xl text-white"></i>
                </div>
                <h3 className="text-xl font-black mb-3 text-slate-900 dark:text-white uppercase tracking-tight">History</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed font-medium">Review past downloads, open folders, or clear logs from previous sessions.</p>
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
                isProcessing={isProcessing}
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
                  disabled={isProcessing || totalItems === 0}
                  onClick={() => startBatchDownload(queue)}
                  className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${isProcessing
                    ? 'bg-slate-700 cursor-not-allowed opacity-50'
                    : 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20 active:scale-95'
                    }`}
                >
                  <i className="fa-solid fa-play"></i>
                  {isProcessing ? 'Processing...' : 'Start Download'}
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

      <footer className="mt-6 flex-shrink-0 text-center text-slate-500 text-[10px] uppercase tracking-widest opacity-50">
        <p>Media-Pull DL • Simplistic Media Download Manager</p>
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
    </div>
  );
};

export default App;
