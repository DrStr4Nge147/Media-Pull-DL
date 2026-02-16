
import React, { useEffect, useRef } from 'react';
import { DownloadItem } from '../types';

interface Props {
  item: DownloadItem;
}

const ActivityLog: React.FC<Props> = ({ item }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      // Check if user is near the bottom (within 50px)
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

      if (isAtBottom) {
        // Use requestAnimationFrame to ensure the DOM has updated with new logs
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, [item.logs]);

  return (
    <div className="bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col min-h-[200px] max-h-[350px] md:max-h-none md:flex-1 shadow-inner dark:shadow-2xl">
      <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 max-w-[70%] truncate">
          <i className="fa-solid fa-terminal text-green-600 dark:text-green-400"></i>
          Terminal: <span className="text-slate-400 dark:text-slate-500 normal-case font-mono">{item.url}</span>
        </h3>
        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded shrink-0 border border-slate-200 dark:border-slate-800">
          ID: {item.id.slice(0, 8)}
        </span>
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-xs text-slate-300 space-y-1 select-text"
      >
        {item.logs.map((log, idx) => (
          <div key={idx} className="flex gap-3">
            <span className="text-slate-600 select-none">[{idx + 1}]</span>
            <span className="break-all">{log}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityLog;
