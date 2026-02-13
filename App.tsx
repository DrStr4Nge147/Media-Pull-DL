
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ViewMode, DownloadItem, DownloadStatus, AppSettings, Preset, DownloadStrategy } from './types';
import DownloadForm from './components/DownloadForm';
import QueueList from './components/QueueList';
import ActivityLog from './components/ActivityLog';
import HistoryPage from './components/HistoryPage';
import SettingsModal from './components/SettingsModal';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_SETTINGS: AppSettings = {
  defaultDestination: './YT-DLP',
  defaultFilenameFormat: '%(title)s.%(ext)s',
  defaultArgs: '--format mp4/best',
  presets: [
    { id: '1', name: 'High Quality Video', args: '-f "bestvideo+bestaudio/best"' },
    { id: '2', name: 'Audio Only (MP3)', args: '-x --audio-format mp3' },
    { id: '3', name: 'Low Res (480p)', args: '-S "res:480"' }
  ]
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

  // Persistence
  useEffect(() => {
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
    const newItem: DownloadItem = {
      ...itemData,
      id: uuidv4(),
      status: DownloadStatus.PENDING,
      progress: 0,
      logs: [`[System] Added to queue at ${new Date().toLocaleTimeString()}`],
      timestamp: Date.now()
    };
    setQueue(prev => [...prev, newItem]);

    if (viewMode === 'SINGLE') {
      startBatchDownload([...queue, newItem]);
    }
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
      } catch (e) {
        updateItemLogsSmart(item.id, `[Error] ${e instanceof Error ? e.message : String(e)}`);
        updateItemStatus(item.id, DownloadStatus.FAILED);
        setHistory(prev => [{ ...item, status: DownloadStatus.FAILED, timestamp: Date.now() }, ...prev]);
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
      setSelectedItemId(item.id);
      updateItemStatus(item.id, DownloadStatus.DOWNLOADING);

      // Real yt-dlp execution
      try {
        await realYtDlpDownload(item);
        updateItemStatus(item.id, DownloadStatus.COMPLETED);
        // Add to history
        setHistory(prev => [{ ...item, status: DownloadStatus.COMPLETED, timestamp: Date.now() }, ...prev]);
        // Continue to next item
        processNext(index + 1);
      } catch (e) {
        updateItemLogsSmart(item.id, `[Error] ${e instanceof Error ? e.message : String(e)}`);
        updateItemStatus(item.id, DownloadStatus.FAILED);
        // Add to history even on failure
        setHistory(prev => [{ ...item, status: DownloadStatus.FAILED, timestamp: Date.now() }, ...prev]);
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

    await w.runYtDlp({ ...item, id: item.id });
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
    if (window.confirm('Clear all downloads?')) {
      setQueue([]);
      setIsProcessing(false);
      setCurrentIndex(-1);
    }
  };

  const resetView = () => {
    if (isProcessing) {
      if (!window.confirm('A download is in progress. Are you sure you want to exit?')) return;
    }
    setViewMode(null);
    setIsProcessing(false);
    setCurrentIndex(-1);
  };

  const totalItems = queue.length;
  const completedItems = queue.filter(i => i.status === DownloadStatus.COMPLETED).length;

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto p-4 md:p-6 lg:p-8 overflow-hidden select-none">
      {updateInfo && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/50 p-4 rounded-2xl flex items-center justify-between backdrop-blur-sm animate-pulse-slow">
          <div className="flex items-center gap-4">
            <div className="bg-amber-500 p-2 rounded-lg shadow-lg shadow-amber-900/40">
              <i className="fa-solid fa-cloud-arrow-down text-white"></i>
            </div>
            <div>
              <p className="font-bold text-amber-200">Update Available!</p>
              <p className="text-amber-400/80 text-sm">
                Current: <span className="font-mono">{updateInfo.current}</span> → Latest: <span className="font-mono font-bold text-amber-300">{updateInfo.latest}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setUpdateInfo(null)}
              className="px-4 py-2 text-amber-400/60 hover:text-amber-200 transition-colors text-sm font-medium"
            >
              Later
            </button>
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-2 rounded-xl font-bold shadow-lg shadow-amber-900/40 transition-all active:scale-95 disabled:opacity-50"
            >
              {isUpdating ? 'Updating...' : 'Update Now'}
            </button>
          </div>
        </div>
      )}

      {updateSuccess && (
        <div className="mb-6 bg-emerald-500/10 border border-emerald-500/50 p-4 rounded-2xl flex items-center justify-between backdrop-blur-sm animate-fadeIn">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500 p-2 rounded-lg shadow-lg shadow-emerald-900/40">
              <i className="fa-solid fa-check text-white"></i>
            </div>
            <div>
              <p className="font-bold text-emerald-200">System is Up to Date</p>
              <p className="text-emerald-400/80 text-sm">
                Running version: <span className="font-mono font-bold text-emerald-300">{updateSuccess}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setUpdateSuccess(null)}
            className="w-10 h-10 rounded-full hover:bg-emerald-500/20 flex items-center justify-center text-emerald-400 transition-colors"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {showUpdateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <i className="fa-solid fa-arrows-rotate text-blue-400 animate-spin-slow"></i>
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
              <div className="bg-slate-950 p-4 rounded-xl font-mono text-sm h-64 overflow-y-auto border border-slate-800 shadow-inner">
                {updateLogs.map((log, i) => (
                  <div key={i} className={`mb-1 ${log.startsWith('[Error]') ? 'text-red-400' : log.startsWith('[System]') ? 'text-blue-400' : 'text-slate-300'}`}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 bg-slate-800/50 flex justify-end">
              <button
                disabled={isUpdating}
                onClick={() => setShowUpdateModal(false)}
                className={`px-6 py-2 rounded-xl font-bold transition-all ${isUpdating ? 'opacity-50 cursor-not-allowed text-slate-500' : 'bg-slate-700 hover:bg-slate-600'}`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="flex-shrink-0 flex justify-between items-center mb-6 bg-slate-800/50 p-5 rounded-2xl border border-slate-700 backdrop-blur-sm">
        <div className="flex items-center gap-4 cursor-pointer" onClick={resetView}>
          <img
            src="./logo.svg"
            alt="YT-DLP"
            className="w-12 h-12 rounded-lg shadow-lg shadow-red-900/20"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              Media-Pull DL
              {currentVersion ? (
                <span className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border shadow-sm font-mono font-bold flex items-center gap-1.5 ${updateInfo ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${updateInfo ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                  {updateInfo ? 'Update Available' : `v${currentVersion}`}
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-slate-700 bg-slate-800/50 text-slate-500 font-mono font-bold animate-pulse">
                  Checking for updates...
                </span>
              )}
            </h1>
            <p className="text-slate-400 text-xs">Simplistic Media Download Manager</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {viewMode && (
            <button
              onClick={openDownloadFolder}
              className="bg-slate-700 hover:bg-slate-600 transition-colors px-4 py-2 rounded-lg font-medium text-sm"
              title="Open download folder"
            >
              <i className="fa-solid fa-folder-open mr-2"></i>
              Open Folder
            </button>
          )}
          {viewMode && (
            <button
              onClick={() => setShowSettings(true)}
              className="bg-slate-700 hover:bg-slate-600 transition-colors p-3 rounded-lg"
              title="Settings & Presets"
            >
              <i className="fa-solid fa-sliders"></i>
            </button>
          )}
          {viewMode && (
            <button
              onClick={resetView}
              className="bg-slate-700 hover:bg-slate-600 transition-colors px-4 py-2 rounded-lg font-medium text-sm"
            >
              Switch Mode
            </button>
          )}
        </div>
      </header>

      {!viewMode ? (
        <div className="flex-1 flex flex-col items-center justify-center animate-fadeIn overflow-y-auto overflow-x-hidden custom-scrollbar px-2">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Choose Your Workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            <button
              onClick={() => setViewMode('SINGLE')}
              className="group p-8 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-3xl transition-all hover:scale-[1.02] transform-gpu text-left relative overflow-hidden flex flex-col no-underline"
            >
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <i className="fa-solid fa-bolt text-9xl"></i>
              </div>
              <div className="bg-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-900/30">
                <i className="fa-solid fa-bolt text-xl"></i>
              </div>
              <h3 className="text-lg font-bold mb-2">Single Download</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Fast, one-off downloads. Perfect for grabbing a quick video.</p>
            </button>

            <button
              onClick={() => setViewMode('QUEUE')}
              className="group p-8 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-3xl transition-all hover:scale-[1.02] transform-gpu text-left relative overflow-hidden flex flex-col no-underline"
            >
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <i className="fa-solid fa-list-check text-9xl"></i>
              </div>
              <div className="bg-purple-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-purple-900/30">
                <i className="fa-solid fa-list-check text-xl"></i>
              </div>
              <h3 className="text-lg font-bold mb-2">Multiple Download</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Build a list and download them sequentially or simultaneously.</p>
            </button>

            <button
              onClick={() => setViewMode('HISTORY')}
              className="group p-8 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-3xl transition-all hover:scale-[1.02] transform-gpu text-left relative overflow-hidden flex flex-col no-underline"
            >
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <i className="fa-solid fa-clock-rotate-left text-9xl"></i>
              </div>
              <div className="bg-amber-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-amber-900/30">
                <i className="fa-solid fa-clock-rotate-left text-xl"></i>
              </div>
              <h3 className="text-lg font-bold mb-2">History</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Review past downloads, open folders, or clear logs.</p>
            </button>
          </div>
        </div>
      ) : viewMode === 'HISTORY' ? (
        <HistoryPage
          history={history}
          onClear={() => setHistory([])}
          onRemove={(id) => setHistory(prev => prev.filter(i => i.id !== id))}
        />
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-8 overflow-hidden">
          <div className="md:col-span-5 lg:col-span-4 h-full flex flex-col space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <i className={`fa-solid ${viewMode === 'SINGLE' ? 'fa-bolt text-blue-400' : 'fa-list-check text-purple-400'}`}></i>
                {viewMode === 'SINGLE' ? 'Quick Download' : 'Multiple Download'}
              </h3>
              <DownloadForm
                onAdd={addToQueue}
                isProcessing={isProcessing}
                mode={viewMode}
                settings={settings}
                sharedDestination={sharedDestination}
                setSharedDestination={setSharedDestination}
                onClear={() => setSelectedItemId(null)}
              />
            </div>

            {viewMode === 'QUEUE' && totalItems > 0 && (
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400">Download Strategy</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button
                    onClick={() => setDownloadStrategy('SEQUENTIAL')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${downloadStrategy === 'SEQUENTIAL'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10'
                      : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                  >
                    <i className="fa-solid fa-arrow-down-1-9 text-lg"></i>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Sequential</span>
                  </button>
                  <button
                    onClick={() => setDownloadStrategy('SIMULTANEOUS')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${downloadStrategy === 'SIMULTANEOUS'
                      ? 'bg-orange-600/20 border-orange-500 text-orange-400 shadow-lg shadow-orange-500/10'
                      : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}
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

          <div className="md:col-span-7 lg:col-span-8 h-full flex flex-col space-y-6 overflow-hidden">
            {totalItems > 0 && (
              <div className="flex-1 min-h-0 bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shrink-0">
                  <h3 className="font-bold flex items-center gap-2">
                    <i className="fa-solid fa-layer-group text-slate-400"></i>
                    Batch List
                  </h3>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={clearQueue}
                      className="text-slate-400 hover:text-red-400 text-[10px] flex items-center gap-1.5 transition-colors font-bold uppercase tracking-wider"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                      Clear
                    </button>
                    <div className="bg-slate-900 px-3 py-1 rounded-full text-[10px] font-mono text-slate-300 border border-slate-700">
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
              <div className="flex-1 bg-slate-800/30 border-2 border-dashed border-slate-700 p-10 md:p-20 rounded-3xl flex flex-col items-center justify-center text-center">
                <div className="bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mb-6">
                  <i className="fa-solid fa-hourglass-start text-3xl text-slate-600"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-400 mb-2">Batch list is empty</h3>
                <p className="text-slate-500 max-w-xs">Fill out the form to the left to start adding your downloads.</p>
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
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      <footer className="mt-6 flex-shrink-0 text-center text-slate-500 text-[10px] uppercase tracking-widest opacity-50">
        <p>Media-Pull DL • Simplistic Media Download Manager</p>
      </footer>
    </div>
  );
};

export default App;
