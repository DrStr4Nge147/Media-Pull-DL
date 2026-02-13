
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
        <div className="flex-1 min-h-0 flex flex-col animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-slate-800/30 p-5 rounded-3xl border border-slate-700/50 backdrop-blur-sm shrink-0">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-3">
                        <div className="bg-blue-500/20 p-2 rounded-xl">
                            <i className="fa-solid fa-clock-rotate-left text-blue-400"></i>
                        </div>
                        Download History
                    </h2>
                    <p className="text-slate-500 text-xs mt-1 ml-11">Review and manage your {history.length} previous downloads</p>
                </div>
                <button
                    onClick={() => {
                        if (window.confirm('Are you sure you want to clear your entire download history?')) {
                            onClear();
                        }
                    }}
                    className="w-full sm:w-auto bg-red-500/10 hover:bg-red-500/20 text-red-500 px-5 py-2.5 rounded-2xl text-[11px] font-bold transition-all border border-red-500/20 flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                    <i className="fa-solid fa-trash-can"></i>
                    Clear History
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-6">
                    {history.map((item) => (
                        <div
                            key={item.id}
                            className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-6 hover:border-blue-500/30 hover:bg-slate-800/60 transition-all group relative overflow-hidden"
                        >
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 h-full">
                                <div className="flex-1 min-w-0 w-full">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${item.status === DownloadStatus.COMPLETED ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]'}`}></div>
                                        <h4 className="font-bold text-slate-100 truncate pr-2 text-sm md:text-base" title={item.filename || item.url}>
                                            {item.filename || item.url}
                                        </h4>
                                    </div>

                                    <p className="text-[11px] text-slate-500 truncate mb-4 font-mono opacity-80" title={item.url}>{item.url}</p>

                                    <div className="flex flex-wrap gap-2 text-[10px] uppercase font-bold tracking-wider">
                                        <span className="flex items-center gap-1.5 bg-slate-900/60 text-slate-400 px-3 py-1.5 rounded-xl border border-slate-700/50">
                                            <i className="fa-solid fa-calendar-alt opacity-70"></i>
                                            {new Date(item.timestamp).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1.5 bg-slate-900/60 text-slate-400 px-3 py-1.5 rounded-xl border border-slate-700/50">
                                            <i className="fa-solid fa-clock opacity-70"></i>
                                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {item.format && (
                                            <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-xl border border-blue-500/20">
                                                <i className="fa-solid fa-closed-captioning"></i>
                                                {item.format}
                                            </span>
                                        )}
                                        {item.resolution && (
                                            <span className="flex items-center gap-1.5 bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-xl border border-purple-500/20">
                                                <i className="fa-solid fa-expand"></i>
                                                {item.resolution}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex sm:flex-col items-center gap-2 w-full sm:w-auto shrink-0 transition-all">
                                    <button
                                        onClick={() => (window as any).openExternal(`file://${item.destination}`)}
                                        className="flex-1 sm:flex-none p-3 rounded-2xl bg-slate-700/50 hover:bg-slate-600 text-slate-300 transition-colors flex items-center justify-center gap-2 sm:aspect-square"
                                        title="Open Folder"
                                    >
                                        <i className="fa-solid fa-folder-open text-xs"></i>
                                        <span className="sm:hidden text-[10px] font-bold uppercase">Open Folder</span>
                                    </button>
                                    <button
                                        onClick={() => onRemove(item.id)}
                                        className="flex-1 sm:flex-none p-3 rounded-2xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all flex items-center justify-center gap-2 sm:aspect-square"
                                        title="Remove from history"
                                    >
                                        <i className="fa-solid fa-trash text-xs"></i>
                                        <span className="sm:hidden text-[10px] font-bold uppercase">Remove</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HistoryPage;
