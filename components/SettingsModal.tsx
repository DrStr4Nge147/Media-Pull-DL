
import React, { useState } from 'react';
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

  const handleSave = () => {
    onSave(localSettings);
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
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl animate-fadeIn">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold">App Settings & Presets</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-8">
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Global Defaults</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Default Path</label>
                <input 
                  type="text" 
                  value={localSettings.defaultDestination}
                  onChange={e => setLocalSettings(prev => ({ ...prev, defaultDestination: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Default Filename Format</label>
                <input 
                  type="text" 
                  value={localSettings.defaultFilenameFormat}
                  onChange={e => setLocalSettings(prev => ({ ...prev, defaultFilenameFormat: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Base Arguments</label>
              <input 
                type="text" 
                value={localSettings.defaultArgs}
                onChange={e => setLocalSettings(prev => ({ ...prev, defaultArgs: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest">Arguments Presets</h3>
            <div className="space-y-3">
              {localSettings.presets.map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-700">
                  <div className="flex-1">
                    <p className="text-sm font-bold">{p.name}</p>
                    <code className="text-[10px] text-slate-400 break-all">{p.args}</code>
                  </div>
                  <button 
                    onClick={() => removePreset(p.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-slate-900/50 p-4 rounded-2xl border border-dashed border-slate-600">
              <p className="text-xs font-bold mb-3 text-slate-300">New Preset</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <input 
                  type="text" 
                  placeholder="Preset Name"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <input 
                  type="text" 
                  placeholder="yt-dlp args"
                  value={newPresetArgs}
                  onChange={e => setNewPresetArgs(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <button 
                onClick={addPreset}
                className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-xs font-bold transition-colors"
              >
                Add Preset
              </button>
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-slate-700 flex gap-3">
          <button 
            onClick={handleSave}
            className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-colors"
          >
            Save Changes
          </button>
          <button 
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-bold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
