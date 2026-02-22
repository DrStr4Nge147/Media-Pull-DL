
import React from 'react';

interface Props {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    type?: 'danger' | 'info';
}

const ConfirmationModal: React.FC<Props> = ({
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    type = 'danger'
}) => {
    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/40 dark:bg-slate-950/90 backdrop-blur-sm animate-fadeIn"
            style={{ WebkitAppRegion: 'no-drag' } as any}
        >
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-8 text-center">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 shadow-lg ${type === 'danger'
                        ? 'bg-red-600/20 border-red-500/50 text-red-500 shadow-red-900/30'
                        : 'bg-blue-600/20 border-blue-500/50 text-blue-500 shadow-blue-900/30'
                        }`}>
                        <i className={`fa-solid ${type === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-info'} text-4xl`}></i>
                    </div>

                    <h3 className="text-2xl font-bold mb-3 text-slate-800 dark:text-white">
                        {title}
                    </h3>

                    <p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
                        {message}
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-6 py-3 rounded-xl font-bold transition-all bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 text-white ${type === 'danger'
                                ? 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 shadow-red-900/40'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-900/40'
                                }`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
