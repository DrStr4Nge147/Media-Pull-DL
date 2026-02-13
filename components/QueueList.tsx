
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
    <div className="h-full overflow-y-auto divide-y divide-slate-800 custom-scrollbar">
      {items.map((item, index) => {
        const isActive = index === currentIndex;
        const isSelected = item.id === selectedId;

        return (
          <div
            key={item.id}
            onClick={() => onSelect?.(item.id)}
            className={`p-4 cursor-pointer transition-all border-l-4 ${isSelected
              ? 'bg-blue-900/20 border-blue-500 shadow-inner'
              : isActive
                ? 'bg-slate-800/20 border-blue-500/30'
                : 'hover:bg-slate-800/40 border-transparent'
              }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-slate-500">{index + 1}.</span>
                  <h4 className="font-medium text-sm truncate text-slate-200" title={item.url}>
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
                    <span className="flex items-center gap-1 bg-slate-800 px-1.5 rounded ring-1 ring-slate-700">
                      <i className="fa-solid fa-clapperboard"></i>
                      {item.format.toUpperCase()}
                    </span>
                  )}
                  {item.resolution && (
                    <span className="flex items-center gap-1 bg-slate-800 px-1.5 rounded ring-1 ring-slate-700">
                      <i className="fa-solid fa-expand"></i>
                      {item.resolution}
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
                  className={`p-1.5 rounded-lg transition-colors ${isSelected ? 'text-blue-400 bg-blue-900/40' : 'text-slate-500 hover:text-blue-400 hover:bg-slate-800'
                    }`}
                  title="View Terminal Output"
                >
                  <i className="fa-solid fa-terminal text-xs"></i>
                </button>

                <StatusBadge status={item.status} />
                {isActive && (item.status === DownloadStatus.DOWNLOADING || item.status === DownloadStatus.PAUSED) && (
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
                  disabled={isActive}
                  className={`text-slate-600 hover:text-red-400 transition-colors ${isActive ? 'opacity-20 cursor-not-allowed' : ''}`}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            {item.status !== DownloadStatus.PENDING && (
              <div className="space-y-1">
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${item.status === DownloadStatus.COMPLETED
                      ? 'bg-green-500'
                      : item.status === DownloadStatus.FAILED
                        ? 'bg-red-500'
                        : item.status === DownloadStatus.PAUSED
                          ? 'bg-yellow-500'
                          : 'bg-blue-500'
                      }`}
                    style={{ width: `${item.progress}%` }}
                  ></div>
                </div>
                {item.status === DownloadStatus.DOWNLOADING && (
                  <div className="flex justify-between text-[10px] font-mono text-blue-400">
                    <span>PROGRESS</span>
                    <span>{Math.round(item.progress)}%</span>
                  </div>
                )}
                {item.status === DownloadStatus.PAUSED && (
                  <div className="flex justify-between text-[10px] font-mono text-yellow-400">
                    <span>PAUSED</span>
                    <span>{Math.round(item.progress)}%</span>
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
    [DownloadStatus.PENDING]: 'bg-slate-700 text-slate-400 border-slate-600',
    [DownloadStatus.DOWNLOADING]: 'bg-blue-900/30 text-blue-400 border-blue-800/50 animate-pulse',
    [DownloadStatus.PAUSED]: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/50',
    [DownloadStatus.COMPLETED]: 'bg-green-900/30 text-green-400 border-green-800/50',
    [DownloadStatus.FAILED]: 'bg-red-900/30 text-red-400 border-red-800/50',
  };

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-tighter ${styles[status]}`}>
      {status}
    </span>
  );
};

export default QueueList;
