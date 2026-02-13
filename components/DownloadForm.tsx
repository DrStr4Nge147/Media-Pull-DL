
import React, { useState, useEffect } from 'react';
import { DownloadItem, DownloadStatus, AppSettings, ViewMode } from '../types';

interface Props {
  onAdd: (item: Omit<DownloadItem, 'id' | 'status' | 'progress' | 'logs' | 'timestamp'>) => void;
  isProcessing: boolean;
  mode: ViewMode;
  settings: AppSettings;
  sharedDestination: string;
  setSharedDestination: (dest: string) => void;
  onClear?: () => void;
}

const DownloadForm: React.FC<Props> = ({ onAdd, isProcessing, mode, settings, sharedDestination, setSharedDestination, onClear }) => {
  const [url, setUrl] = useState('');
  const [referer, setReferer] = useState('');
  const [filename, setFilename] = useState('');
  const [extraArgs, setExtraArgs] = useState('');
  const [format, setFormat] = useState('mp4');
  const [resolution, setResolution] = useState('1080p');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  const [availableResolutions, setAvailableResolutions] = useState<string[]>(['best', '2160p', '1440p', '1080p', '720p', '480p', '360p']);
  const [availableFormats, setAvailableFormats] = useState<string[]>(['mp4', 'mkv', 'webm', 'mp3', 'm4a']);

  useEffect(() => {
    if (!url.trim() || !url.startsWith('http')) {
      setMetadata(null);
      return;
    }

    const timer = setTimeout(async () => {
      setFetchingMetadata(true);
      try {
        const data = await (window as any).getVideoMetadata(url);
        setMetadata(data);

        if (data.formats) {
          const resSet = new Set<number>();
          data.formats.forEach((f: any) => {
            if (f.height) resSet.add(f.height);
          });
          const sortedRes = Array.from(resSet)
            .sort((a, b) => b - a)
            .map(r => `${r}p`);
          setAvailableResolutions(['best', ...sortedRes]);

          const extSet = new Set<string>();
          data.formats.forEach((f: any) => {
            if (f.ext) extSet.add(f.ext);
          });
          // Add mp3 manually as it's a common conversion
          extSet.add('mp3');
          setAvailableFormats(Array.from(extSet));
        }

        if (data.title && !filename) {
          setFilename(data.title.replace(/[\\/:*?"<>|]/g, '_'));
        }
      } catch (e) {
        console.error('Metadata fetch failed:', e);
      } finally {
        setFetchingMetadata(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    onAdd({
      url: url.trim(),
      referer: referer.trim(),
      destination: sharedDestination.trim(),
      filename: filename.trim() || settings.defaultFilenameFormat,
      format,
      resolution,
      extraArgs: showAdvanced ? extraArgs.trim() : '',
    });

    if (mode === 'QUEUE' || mode === 'SINGLE') {
      clearForm();
    }
  };

  const clearForm = () => {
    setUrl('');
    setReferer('');
    setFilename('');
    setExtraArgs('');
    setMetadata(null);
    setFetchingMetadata(false);
    onClear?.();
  };

  const applyPreset = (args: string) => {
    setExtraArgs(args);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Main URL</label>
          <button
            type="button"
            onClick={clearForm}
            className="text-[10px] font-bold text-slate-500 hover:text-red-400 transition-colors uppercase flex items-center gap-1"
          >
            <i className="fa-solid fa-rotate-left"></i>
            Reset Form
          </button>
        </div>
        <div className="relative">
          <input
            type="url"
            required
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm pr-10"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {fetchingMetadata && <i className="fa-solid fa-circle-notch fa-spin text-blue-500 text-xs"></i>}
            <i className="fa-solid fa-link text-slate-600"></i>
          </div>
        </div>
      </div>

      {
        fetchingMetadata ? (
          <div className="bg-slate-900/30 border-2 border-dashed border-slate-700 p-8 rounded-2xl flex flex-col items-center justify-center animate-pulse-slow">
            <div className="bg-blue-600/20 p-4 rounded-full mb-4">
              <i className="fa-solid fa-wand-magic-sparkles text-blue-400 text-2xl animate-bounce"></i>
            </div>
            <h4 className="text-slate-300 font-bold mb-1">Detecting Video Details...</h4>
            <p className="text-slate-500 text-xs">Fetching available formats and resolutions</p>
          </div>
        ) : (
          <>
            {metadata && (
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 flex gap-4 animate-fadeIn">
                {metadata.thumbnail && (
                  <img src={metadata.thumbnail} alt="" className="w-24 h-16 object-cover rounded-lg shadow-lg" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-200 truncate">{metadata.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 truncate">{metadata.uploader || metadata.webpage_url_domain}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-mono">
                      {metadata.duration_string || 'N/A'}
                    </span>
                    <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 font-mono">
                      {metadata.view_count ? `${(metadata.view_count / 1000000).toFixed(1)}M views` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Resolution</label>
                <div className="relative">
                  <select
                    value={resolution}
                    onChange={e => setResolution(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer"
                  >
                    {availableResolutions.map(res => (
                      <option key={res} value={res}>{res === 'best' ? 'Best Quality' : res}</option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"></i>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">File Format</label>
                <div className="relative">
                  <select
                    value={format}
                    onChange={e => setFormat(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer"
                  >
                    {availableFormats.map(ext => (
                      <option key={ext} value={ext}>{ext.toUpperCase()}</option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"></i>
                </div>
              </div>
            </div>

            <div className="animate-fadeIn">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Filename</label>
              <div className="relative">
                <input
                  type="text"
                  value={filename}
                  onChange={e => setFilename(e.target.value)}
                  placeholder="video_name (extension added automatically)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm pr-10"
                />
                <i className="fa-solid fa-file-signature absolute right-4 top-1/2 -translate-y-1/2 text-slate-600"></i>
              </div>
            </div>
          </>
        )
      }

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Advanced Options</label>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`text-[10px] font-bold px-2 py-1 rounded transition-all ${showAdvanced ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}
          >
            {showAdvanced ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-4 animate-slideDown">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Referer URL</label>
              <div className="relative">
                <input
                  type="text"
                  value={referer}
                  onChange={e => setReferer(e.target.value)}
                  placeholder="https://example.com/source (Optional)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm pr-10"
                />
                <i className="fa-solid fa-compass absolute right-4 top-1/2 -translate-y-1/2 text-slate-700"></i>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1 ml-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Extra Arguments</label>
                <button
                  type="button"
                  onClick={() => (window as any).openExternal('https://github.com/yt-dlp/yt-dlp#usage-and-options')}
                  className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <i className="fa-brands fa-github"></i>
                  Documentation
                </button>
              </div>
              <textarea
                value={extraArgs}
                onChange={e => setExtraArgs(e.target.value)}
                placeholder="--proxy http://127.0.0.1:1080 --cookies-from-browser chrome ..."
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm font-mono resize-none shadow-inner"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {settings.presets.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.args)}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1 rounded-full text-slate-300 font-medium transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isProcessing && mode === 'SINGLE'}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all relative overflow-hidden group ${isProcessing && mode === 'SINGLE'
            ? 'bg-slate-700 cursor-not-allowed text-slate-500'
            : mode === 'SINGLE'
              ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/40 active:scale-[0.98]'
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/40 active:scale-[0.98]'
            }`}
        >
          <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          <i className={`fa-solid ${mode === 'SINGLE' ? 'fa-download' : 'fa-plus'} relative z-10`}></i>
          <span className="relative z-10">
            {mode === 'SINGLE' ? (isProcessing ? 'Processing...' : 'Download Now') : 'Add to Queue'}
          </span>
        </button>
      </div>
    </form >
  );
};

export default DownloadForm;
