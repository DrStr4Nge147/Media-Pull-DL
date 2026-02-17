
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
                <div className="bg-slate-50 dark:bg-slate-800/20 w-24 h-24 rounded-[2rem] flex items-center justify-center mb-8 border border-slate-200 dark:border-slate-700 shadow-sm relative group hover:rotate-6 transition-transform">
                    <i className="fa-solid fa-clock-rotate-left text-4xl text-slate-300 dark:text-slate-600 animate-pulse-slow"></i>
                    <div className="absolute inset-0 bg-blue-500/5 rounded-[2rem] animate-ping opacity-20"></div>
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-300 tracking-tight mb-3 uppercase text-center">No History Yet</h3>
                <p className="text-slate-500 dark:text-slate-500 max-w-sm text-center font-medium leading-relaxed">Your completed and failed downloads will appear here for your reference.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col animate-fadeIn w-full max-w-[1800px] mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-white dark:bg-slate-800/30 p-5 rounded-3xl border border-slate-200 dark:border-slate-700/50 backdrop-blur-sm shadow-sm dark:shadow-none shrink-0">
                <div>
                    <h2 className="text-2xl font-black flex items-center gap-3 text-slate-900 dark:text-white tracking-tight">
                        <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <i className="fa-solid fa-clock-rotate-left text-white text-base"></i>
                        </div>
                        Download History
                    </h2>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1.5 ml-1 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                        Review and manage your {history.length} previous downloads
                    </p>
                </div>
                <button
                    onClick={onClear}
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
                            className="bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-[2rem] p-8 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group relative overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none"
                        >
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 h-full">
                                <div className="flex-1 min-w-0 w-full">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${item.status === DownloadStatus.COMPLETED ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]'}`}></div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate pr-2 text-sm md:text-base" title={item.filename || item.url}>
                                            {item.filename || item.url}
                                        </h4>
                                    </div>

                                    <p className="text-[11px] text-slate-500 truncate mb-4 font-mono opacity-80" title={item.url}>{item.url}</p>

                                    <div className="flex flex-wrap gap-2 text-[9px] uppercase font-black tracking-widest">
                                        <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                            <i className="fa-solid fa-calendar-alt opacity-50"></i>
                                            {new Date(item.timestamp).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                            <i className="fa-solid fa-clock opacity-50"></i>
                                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {item.format && (
                                            <span className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-xl border border-blue-500/10">
                                                <i className="fa-solid fa-film opacity-70"></i>
                                                {item.format}
                                            </span>
                                        )}
                                        {item.resolution && (
                                            <span className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 px-3 py-1.5 rounded-xl border border-purple-500/10">
                                                <i className="fa-solid fa-expand opacity-70"></i>
                                                {item.resolution}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex sm:flex-col items-center gap-3 w-full sm:w-auto shrink-0">
                                    <button
                                        onClick={() => (window as any).openAndSelectFile(item.destination, item.filename)}
                                        className="flex-1 sm:flex-none p-4 rounded-2xl bg-slate-900 dark:bg-slate-700/50 hover:bg-slate-800 dark:hover:bg-slate-600 text-white dark:text-slate-200 transition-all flex items-center justify-center gap-2 sm:aspect-square shadow-lg shadow-slate-900/10"
                                        title="Open Folder"
                                    >
                                        <i className="fa-solid fa-folder-open text-xs"></i>
                                        <span className="sm:hidden text-[10px] font-bold uppercase tracking-widest">Open Folder</span>
                                    </button>
                                    <button
                                        onClick={() => onRemove(item.id)}
                                        className="flex-1 sm:flex-none p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 hover:bg-red-500 text-red-600 dark:text-red-500 hover:text-white transition-all flex items-center justify-center gap-2 sm:aspect-square border border-red-100 dark:border-transparent"
                                        title="Remove from history"
                                    >
                                        <i className="fa-solid fa-trash text-xs"></i>
                                        <span className="sm:hidden text-[10px] font-bold uppercase tracking-widest">Remove</span>
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
