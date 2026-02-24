import React from 'react';
import { DownloadItem, DownloadStatus } from '../types';

interface FloatingProgressProps {
    items: DownloadItem[];
    onClick: () => void;
}

const FloatingProgress: React.FC<FloatingProgressProps> = ({ items, onClick }) => {
    const activeItems = items.filter(i => i.status === DownloadStatus.DOWNLOADING);
    if (activeItems.length === 0) return null;
    const item = activeItems[0];

    return (
        <div
            onClick={onClick}
            className="fixed bottom-6 right-6 z-[90] w-[380px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-2 border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 px-4 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all animate-slideInUp group select-none flex items-center gap-4"
        >
            <div className="bg-blue-600 w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 group-hover:rotate-6 transition-transform">
                <i className="fa-solid fa-spinner fa-spin text-sm"></i>
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1.5 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                            {item.filename || 'Initializing...'}
                        </p>
                        {activeItems.length > 1 && (
                            <span className="shrink-0 text-[8px] font-black bg-blue-500/10 dark:bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                +{activeItems.length - 1}
                            </span>
                        )}
                    </div>
                    <span className="shrink-0 text-[10px] font-mono font-black text-blue-600 dark:text-blue-400 ml-2">
                        {Math.round(item.progress)}%
                    </span>
                </div>

                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(37,99,235,0.3)]"
                        style={{ width: `${item.progress}%` }}
                    />
                </div>
            </div>

            {/* Subtle shine effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl"></div>
        </div>
    );
};

export default FloatingProgress;
