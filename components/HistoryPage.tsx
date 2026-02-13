
import React from 'react';
import { DownloadItem, DownloadStatus } from '../types';

interface Props {
    history: DownloadItem[];
    onClear: () => void;
    onRemove: (id: string) => void;
}

const HistoryPage: React.FC<Props> = ({ history, onClear, onRemove }) => {
    if (history.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-20 animate-fadeIn">
                <div className="bg-slate-800 w-24 h-24 rounded-full flex items-center justify-center mb-8 shadow-inner ring-1 ring-slate-700">
                    <i className="fa-solid fa-clock-rotate-left text-4xl text-slate-600"></i>
                </div>
                <h3 className="text-2xl font-bold text-slate-400 mb-2">No History Yet</h3>
                <p className="text-slate-500 max-w-sm text-center">Your completed and failed downloads will appear here for your reference.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col animate-fadeIn">
            <div className="flex justify-between items-center mb-8 bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-3">
                        <i className="fa-solid fa-clock-rotate-left text-blue-400"></i>
                        Download History
                    </h2>
                    <p className="text-slate-500 text-xs mt-1">Showing {history.length} previous downloads</p>
                </div>
                <button
                    onClick={() => {
                        if (window.confirm('Are you sure you want to clear your entire download history?')) {
                            onClear();
                        }
                    }}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-red-500/20 flex items-center gap-2"
                >
                    <i className="fa-solid fa-trash-can"></i>
                    Clear History
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {history.map((item) => (
                    <div
                        key={item.id}
                        className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600 transition-all group"
                    >
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`w-2 h-2 rounded-full ${item.status === DownloadStatus.COMPLETED ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></span>
                                    <h4 className="font-bold text-slate-200 truncate pr-4">{item.filename || item.url}</h4>
                                </div>

                                <p className="text-xs text-slate-400 truncate mb-3 opacity-60 font-mono">{item.url}</p>

                                <div className="flex flex-wrap gap-4 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                                    <span className="flex items-center gap-1.5 bg-slate-900/50 px-2 py-1 rounded">
                                        <i className="fa-solid fa-calendar-day text-slate-600 font-normal"></i>
                                        {new Date(item.timestamp).toLocaleDateString()}
                                    </span>
                                    <span className="flex items-center gap-1.5 bg-slate-900/50 px-2 py-1 rounded">
                                        <i className="fa-solid fa-clock text-slate-600 font-normal"></i>
                                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {item.format && (
                                        <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400/80 px-2 py-1 rounded border border-blue-500/10">
                                            <i className="fa-solid fa-clapperboard"></i>
                                            {item.format}
                                        </span>
                                    )}
                                    {item.resolution && (
                                        <span className="flex items-center gap-1.5 bg-purple-500/10 text-purple-400/80 px-2 py-1 rounded border border-purple-500/10">
                                            <i className="fa-solid fa-expand"></i>
                                            {item.resolution}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => (window as any).openExternal(`file://${item.destination}`)}
                                    className="p-2.5 rounded-xl bg-slate-700/50 hover:bg-slate-600 text-slate-300 transition-colors"
                                    title="Open Folder"
                                >
                                    <i className="fa-solid fa-folder-open text-xs"></i>
                                </button>
                                <button
                                    onClick={() => onRemove(item.id)}
                                    className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all"
                                    title="Remove from history"
                                >
                                    <i className="fa-solid fa-xmark text-xs"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HistoryPage;
