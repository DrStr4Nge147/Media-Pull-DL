
import React, { useEffect, useRef, useState } from 'react';
import { DownloadItem } from '../types';

interface Props {
  item: DownloadItem;
}

const ActivityLog: React.FC<Props> = ({ item }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const isNewItem = useRef(true);
  const lastItemId = useRef(item.id);

  useEffect(() => {
    if (lastItemId.current !== item.id) {
      isNewItem.current = true;
      lastItemId.current = item.id;
    }

    const container = scrollContainerRef.current;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
      if (isAtBottom || isNewItem.current) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });

        if (isNewItem.current) {
          // Reset the flag after a short delay to allow layout to settle
          setTimeout(() => {
            isNewItem.current = false;
          }, 100);
        }
      }
    }
  }, [item.logs, item.id]);

  const handleCopy = async () => {
    const logText = item.logs.join('\n');
    try {
      await navigator.clipboard.writeText(logText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col min-h-[200px] max-h-[350px] md:max-h-none md:flex-1 shadow-inner dark:shadow-2xl animate-fadeIn">
      <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 min-w-0 flex-1">
          <i className="fa-solid fa-terminal text-green-600 dark:text-green-400"></i>
          <span className="truncate">Terminal: <span className="text-slate-400 dark:text-slate-500 normal-case font-mono">{item.url}</span></span>
        </h3>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${copied
              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500'
              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-500 hover:border-blue-500/50'
              }`}
          >
            <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
            {copied ? 'Copied' : 'Copy Logs'}
          </button>

          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
            ID: {item.id.slice(0, 8)}
          </span>
        </div>
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-xs text-slate-300 space-y-1 select-text custom-scrollbar bg-slate-950/50"
      >
        {item.logs.map((log, idx) => (
          <div key={idx} className="flex gap-3 group">
            <span className="text-slate-700 select-none w-8 text-right shrink-0 group-hover:text-slate-500 transition-colors">[{idx + 1}]</span>
            <span className="break-all leading-relaxed">{log}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityLog;
