
import React, { useState, useEffect } from 'react';
import { AppSettings, Preset } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<Props> = ({ settings, onSave, onClose }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings });
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetArgs, setNewPresetArgs] = useState('');

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(settings);

  // Real-time theme preview
  useEffect(() => {
    if (localSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [localSettings.theme]);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleCancel = () => {
    // Revert to original theme before closing
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    onClose();
  };

  const addPreset = () => {
    if (!newPresetName || !newPresetArgs) return;
    const newPreset: Preset = {
      id: uuidv4(),
      name: newPresetName,
      args: newPresetArgs
    };
    setLocalSettings(prev => ({
      ...prev,
      presets: [...prev.presets, newPreset]
    }));
    setNewPresetName('');
    setNewPresetArgs('');
  };

  const removePreset = (id: string) => {
    setLocalSettings(prev => ({
      ...prev,
      presets: prev.presets.filter(p => p.id !== id)
    }));
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl animate-fadeIn">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">App Settings & Presets</h2>
          <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-8 custom-scrollbar">
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Appearance</h3>
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50">
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-white">Application Theme</p>
                <p className="text-xs text-slate-500">Choose your preferred visual style</p>
              </div>
              <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <button
                  type="button"
                  onClick={() => setLocalSettings(prev => ({ ...prev, theme: 'light' }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${localSettings.theme === 'light' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  <i className="fa-solid fa-sun text-sm"></i>
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setLocalSettings(prev => ({ ...prev, theme: 'dark' }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${localSettings.theme === 'dark' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                  <i className="fa-solid fa-moon text-sm"></i>
                  Dark
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Global Defaults</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">Default Path</label>
                <input
                  type="text"
                  value={localSettings.defaultDestination}
                  onChange={e => setLocalSettings(prev => ({ ...prev, defaultDestination: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white transition-all shadow-inner"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">Filename Format</label>
                <input
                  type="text"
                  value={localSettings.defaultFilenameFormat}
                  onChange={e => setLocalSettings(prev => ({ ...prev, defaultFilenameFormat: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white transition-all shadow-inner"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">Base Arguments</label>
              <input
                type="text"
                value={localSettings.defaultArgs}
                onChange={e => setLocalSettings(prev => ({ ...prev, defaultArgs: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white transition-all shadow-inner"
              />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">Arguments Presets</h3>
            <div className="space-y-3">
              {localSettings.presets.map(p => (
                <div key={p.id} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 hover:border-blue-500/30 transition-all group">
                  <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <i className="fa-solid fa-code text-blue-500 dark:text-blue-400"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{p.name}</p>
                    <code className="text-[10px] text-slate-500 dark:text-slate-400 break-all font-mono">{p.args}</code>
                  </div>
                  <button
                    onClick={() => removePreset(p.id)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                    title="Remove Preset"
                  >
                    <i className="fa-solid fa-trash-can text-sm"></i>
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/30 p-6 rounded-3xl border border-dashed border-slate-300 dark:border-slate-600">
              <p className="text-xs font-bold mb-4 text-slate-600 dark:text-slate-300 uppercase tracking-wider">Create New Preset</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Preset Name (e.g., Ultra HD)"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white shadow-sm transition-all"
                />
                <input
                  type="text"
                  placeholder="yt-dlp arguments"
                  value={newPresetArgs}
                  onChange={e => setNewPresetArgs(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white shadow-sm transition-all"
                />
              </div>
              <button
                type="button"
                onClick={addPreset}
                className="w-full bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 py-3 rounded-xl text-xs font-bold transition-all text-white shadow-lg shadow-slate-900/10 dark:shadow-none flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-plus"></i>
                Add Preset
              </button>
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${hasChanges
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
          >
            Save Changes
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 py-3 rounded-xl font-bold transition-colors text-slate-700 dark:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
