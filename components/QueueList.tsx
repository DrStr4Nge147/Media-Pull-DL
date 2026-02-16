
import React from 'react';
import { DownloadItem, DownloadStatus } from '../types';

interface Props {
  items: DownloadItem[];
  onRemove: (id: string) => void;
  currentIndex: number;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onStop?: (id: string) => void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

const QueueList: React.FC<Props> = ({
  items,
  onRemove,
  currentIndex,
  onPause,
  onResume,
  onStop,
  selectedId,
  onSelect
}) => {
  return (
    <div className="h-full overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 custom-scrollbar">
      {items.map((item, index) => {
        const isItemActive = item.status === DownloadStatus.DOWNLOADING || item.status === DownloadStatus.PAUSED;
        const isSelected = item.id === selectedId;

        return (
          <div
            key={item.id}
            onClick={() => onSelect?.(item.id)}
            className={`p-5 cursor-pointer transition-all border-l-4 ${isSelected
              ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-600 shadow-[inset_0_0_15px_rgba(37,99,235,0.05)]'
              : isItemActive
                ? 'bg-slate-50/50 dark:bg-slate-800/20 border-blue-500/30'
                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-transparent'
              }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{index + 1}.</span>
                  <h4 className="font-medium text-sm truncate text-slate-800 dark:text-slate-200" title={item.url}>
                    {item.url}
                  </h4>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-folder"></i>
                    {item.destination}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-file"></i>
                    {item.filename}
                  </span>
                  {item.format && (
                    <span className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700 shadow-sm">
                      <i className="fa-solid fa-clapperboard opacity-50"></i>
                      <span className="font-black text-slate-700 dark:text-slate-300">{item.format.toUpperCase()}</span>
                    </span>
                  )}
                  {item.resolution && (
                    <span className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700 shadow-sm">
                      <i className="fa-solid fa-expand opacity-50"></i>
                      <span className="font-black text-slate-700 dark:text-slate-300">{item.resolution}</span>
                    </span>
                  )}
                  {item.sponsorBlock && (
                    <span className="flex items-center gap-1 bg-green-900/30 text-green-400 px-1.5 rounded ring-1 ring-green-800/50" title={`SponsorBlock: ${item.sponsorBlockCategories?.join(', ')}`}>
                      <i className="fa-solid fa-shield-halved"></i>
                      SB
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.(item.id);
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${isSelected ? 'text-blue-500 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-900/40' : 'text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  title="View Terminal Output"
                >
                  <i className="fa-solid fa-terminal text-xs"></i>
                </button>

                <StatusBadge status={item.status} />
                {(item.status === DownloadStatus.DOWNLOADING || item.status === DownloadStatus.PAUSED) && (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {item.status === DownloadStatus.DOWNLOADING ? (
                      <button
                        onClick={() => onPause?.(item.id)}
                        className="text-xs bg-yellow-600 hover:bg-yellow-500 px-2 py-1 rounded transition-colors"
                        title="Pause"
                      >
                        <i className="fa-solid fa-pause"></i>
                      </button>
                    ) : (
                      <button
                        onClick={() => onResume?.(item.id)}
                        className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded transition-colors"
                        title="Resume"
                      >
                        <i className="fa-solid fa-play"></i>
                      </button>
                    )}
                    <button
                      onClick={() => onStop?.(item.id)}
                      className="text-xs bg-red-600 hover:bg-red-500 px-2 py-1 rounded transition-colors"
                      title="Stop"
                    >
                      <i className="fa-solid fa-stop"></i>
                    </button>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                  disabled={item.status === DownloadStatus.DOWNLOADING || item.status === DownloadStatus.PAUSED}
                  className={`text-slate-600 hover:text-red-400 transition-colors ${item.status === DownloadStatus.DOWNLOADING || item.status === DownloadStatus.PAUSED ? 'opacity-20 cursor-not-allowed' : ''}`}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            {item.status !== DownloadStatus.PENDING && (
              <div className="space-y-1">
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner border border-slate-200/50 dark:border-slate-700/50">
                  <div
                    className={`h-full transition-all duration-500 ease-out relative ${item.status === DownloadStatus.COMPLETED
                      ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                      : item.status === DownloadStatus.FAILED
                        ? 'bg-gradient-to-r from-red-600 to-red-400'
                        : item.status === DownloadStatus.PAUSED
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-500'
                      }`}
                    style={{ width: `${item.progress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
                {item.status === DownloadStatus.DOWNLOADING && (
                  <div className="flex justify-between text-[10px] font-mono text-blue-600 dark:text-blue-400 px-1">
                    <span className="font-bold tracking-widest uppercase opacity-70">Downloading</span>
                    <span className="font-black tracking-widest">{Math.round(item.progress)}%</span>
                  </div>
                )}
                {item.status === DownloadStatus.PAUSED && (
                  <div className="flex justify-between text-[10px] font-mono text-amber-600 dark:text-amber-400 px-1">
                    <span className="font-bold tracking-widest uppercase opacity-70">Paused</span>
                    <span className="font-black tracking-widest">{Math.round(item.progress)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const StatusBadge: React.FC<{ status: DownloadStatus }> = ({ status }) => {
  const styles = {
    [DownloadStatus.PENDING]: 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600',
    [DownloadStatus.DOWNLOADING]: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50 shadow-sm',
    [DownloadStatus.PAUSED]: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 shadow-sm',
    [DownloadStatus.COMPLETED]: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 shadow-sm',
    [DownloadStatus.FAILED]: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50 shadow-sm',
  };

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-tighter ${styles[status]}`}>
      {status}
    </span>
  );
};

export default QueueList;
