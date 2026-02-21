
import React, { useState, useEffect } from 'react';

const TitleBar: React.FC<{ appVersion: string }> = ({ appVersion }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const win = window as any;

    useEffect(() => {
        if (win.windowControls && win.windowControls.onMaximizedStatus) {
            win.windowControls.onMaximizedStatus((status: boolean) => {
                setIsMaximized(status);
            });
        }
    }, [win.windowControls]);

    const handleMinimize = () => win.windowControls?.minimize();
    const handleMaximize = () => win.windowControls?.maximize();
    const handleClose = () => win.windowControls?.close();

    return (
        <div
            className="h-10 flex items-center justify-between bg-white dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/50 select-none z-[200]"
            style={{ WebkitAppRegion: 'drag' } as any}
        >
            <div className="flex items-center px-4 gap-3">
                <div className="bg-gradient-to-br from-red-600 to-red-500 p-1.5 rounded-lg shadow-lg shadow-red-500/20">
                    <i className="fa-solid fa-cloud-arrow-down text-[8px] text-white"></i>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black tracking-widest text-slate-900 dark:text-white uppercase">
                        Media-Pull DL
                    </span>
                    <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                        v{appVersion}
                    </span>
                </div>
            </div>

            <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <button
                    onClick={handleMinimize}
                    className="h-full px-5 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all"
                    title="Minimize"
                >
                    <i className="fa-solid fa-minus text-[10px]"></i>
                </button>
                <button
                    onClick={handleMaximize}
                    className="h-full px-5 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all"
                    title={isMaximized ? "Restore" : "Maximize"}
                >
                    {isMaximized ? (
                        <i className="fa-regular fa-clone text-[10px]"></i>
                    ) : (
                        <i className="fa-regular fa-square text-[10px]"></i>
                    )}
                </button>
                <button
                    onClick={handleClose}
                    className="h-full px-5 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-red-500 hover:text-white transition-all"
                    title="Close"
                >
                    <i className="fa-solid fa-xmark text-[14px]"></i>
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
