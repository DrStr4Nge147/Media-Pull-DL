
import React, { useState, useEffect } from 'react';
import { DownloadItem, DownloadStatus, AppSettings, ViewMode } from '../types';

interface Props {
  onAdd: (item: Omit<DownloadItem, 'id' | 'status' | 'progress' | 'logs' | 'timestamp'>) => void;
  onAddMultiple: (items: Omit<DownloadItem, 'id' | 'status' | 'progress' | 'logs' | 'timestamp'>[]) => void;
  isProcessing: boolean;
  mode: ViewMode;
  settings: AppSettings;
  sharedDestination: string;
  setSharedDestination: (dest: string) => void;
  onClear?: () => void;
}

const DownloadForm: React.FC<Props> = ({ onAdd, onAddMultiple, isProcessing, mode, settings, sharedDestination, setSharedDestination, onClear }) => {
  const [url, setUrl] = useState('');
  const [referer, setReferer] = useState('');
  const [filename, setFilename] = useState('');
  const [extraArgs, setExtraArgs] = useState('');
  const [format, setFormat] = useState('mp4');
  const [resolution, setResolution] = useState('1080p');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [fetchingPlaylist, setFetchingPlaylist] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [playlistData, setPlaylistData] = useState<any>(null);
  const [selectedPlaylistItems, setSelectedPlaylistItems] = useState<Set<string>>(new Set());
  const [availableResolutions, setAvailableResolutions] = useState<string[]>(['best', '2160p', '1440p', '1080p', '720p', '480p', '360p']);
  const [availableFormats, setAvailableFormats] = useState<string[]>(['mp4', 'mkv', 'webm', 'mp3', 'm4a']);
  const [sponsorBlock, setSponsorBlock] = useState(false);
  const [sponsorBlockCategories, setSponsorBlockCategories] = useState<string[]>(['music_offtopic']);

  const SPONSORBLOCK_CATEGORIES = [
    { id: 'music_offtopic', label: 'Non-music and off-topic portions' },
    { id: 'sponsor', label: 'Sponsors' },
    { id: 'intro', label: 'Intro' },
    { id: 'outro', label: 'Outro' },
    { id: 'selfpromo', label: 'Self promos' },
    { id: 'preview', label: 'Previews' },
    { id: 'filler', label: 'Fillers' },
    { id: 'interaction', label: 'Subscription reminders' },
    { id: 'poi_highlight', label: 'Hook' },
  ];

  useEffect(() => {
    if (!url.trim() || !url.startsWith('http')) {
      setMetadata(null);
      setMetadataError(null);
      return;
    }

    const timer = setTimeout(async () => {
      let isPlaylistLink = false;
      try {
        const urlObj = new URL(url);
        isPlaylistLink = urlObj.searchParams.has('list') || urlObj.pathname.includes('/playlist');
      } catch {
        isPlaylistLink = url.includes('list=');
      }

      if (isPlaylistLink && mode === 'QUEUE') {
        setFetchingPlaylist(true);
        try {
          const data = await (window as any).getPlaylistMetadata(url);
          setPlaylistData(data);
          if (data.entries) {
            setSelectedPlaylistItems(new Set(data.entries.filter((e: any) => e).map((e: any) => e.url || e.id)));
          }
        } catch (e) {
          console.error('Playlist fetch failed:', e);
        } finally {
          setFetchingPlaylist(false);
        }
      }

      setFetchingMetadata(true);
      setMetadataError(null);
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
          setFilename(data.title.replace(/[\\/:*?"<>|]/g, '_').replace(/\.+$/, ''));
        }
      } catch (e) {
        console.error('Metadata fetch failed:', e);
        const errorMessage = e instanceof Error ? e.message : String(e);

        // Provide user-friendly error messages
        if (errorMessage.includes('Unsupported URL') || errorMessage.includes('not supported')) {
          setMetadataError('This site is not supported for media extraction. You can still try downloading, but format/resolution detection is unavailable.');
        } else if (errorMessage.includes('HTTP Error') || errorMessage.includes('network')) {
          setMetadataError('Network error: Unable to fetch media information. Please check your connection.');
        } else if (errorMessage.includes('Video unavailable') || errorMessage.includes('Private video')) {
          setMetadataError('This video is unavailable or private. Please check the URL.');
        } else {
          setMetadataError('Unable to fetch media information from this URL. The site may not be supported or the URL may be invalid.');
        }
        setMetadata(null);
      } finally {
        setFetchingMetadata(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    if (playlistData && playlistData.entries && playlistData.entries.length > 0 && selectedPlaylistItems.size > 0 && mode === 'QUEUE') {
      const selectedEntries = playlistData.entries.filter((e: any) => e && selectedPlaylistItems.has(e.url || e.id));
      const items = selectedEntries.map((e: any) => ({
        url: e.url || `https://www.youtube.com/watch?v=${e.id}`,
        referer: referer.trim(),
        destination: sharedDestination.trim(),
        filename: e.title ? e.title.replace(/[\\/:*?"<>|]/g, '_').replace(/\.+$/, '') : settings.defaultFilenameFormat,
        format,
        resolution,
        extraArgs: showAdvanced ? extraArgs.trim() : '',
        sponsorBlock,
        sponsorBlockCategories: sponsorBlock ? sponsorBlockCategories : [],
      }));
      onAddMultiple(items);
    } else {
      onAdd({
        url: url.trim(),
        referer: referer.trim(),
        destination: sharedDestination.trim(),
        filename: filename.trim() || settings.defaultFilenameFormat,
        format,
        resolution,
        extraArgs: showAdvanced ? extraArgs.trim() : '',
        sponsorBlock,
        sponsorBlockCategories: sponsorBlock ? sponsorBlockCategories : [],
      });
    }

    if (mode === 'QUEUE' || mode === 'SINGLE') {
      clearForm();
    }
  };

  const clearForm = () => {
    setUrl('');
    setReferer('');
    setFilename('');
    setFilename('');
    setExtraArgs('');
    setSponsorBlock(false);
    setSponsorBlockCategories(['music_offtopic']);
    setMetadata(null);
    setMetadataError(null);
    setPlaylistData(null);
    setFetchingMetadata(false);
    setFetchingPlaylist(false);
    setSelectedPlaylistItems(new Set());
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
        (fetchingMetadata || fetchingPlaylist) ? (
          <div className="bg-slate-900/30 border-2 border-dashed border-slate-700 p-8 rounded-2xl flex flex-col items-center justify-center animate-pulse-slow">
            <div className="bg-blue-600/20 p-4 rounded-full mb-4">
              <i className="fa-solid fa-wand-magic-sparkles text-blue-400 text-2xl animate-bounce"></i>
            </div>
            <h4 className="text-slate-300 font-bold mb-1">
              {fetchingPlaylist ? 'Analyzing Playlist...' : 'Analyzing Media...'}
            </h4>
            <p className="text-slate-500 text-xs">This may take a few seconds...</p>
          </div>
        ) : (
          <>
            {playlistData && playlistData.entries && playlistData.entries.length > 0 && mode === 'QUEUE' && (
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden animate-fadeIn mb-5">
                <div className="bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Playlist: {playlistData.title || 'Untitled'}</h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPlaylistItems(new Set(playlistData.entries.map((e: any) => e.url || e.id)))}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase transition-colors"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPlaylistItems(new Set())}
                      className="text-[10px] text-slate-500 hover:text-red-400 font-bold uppercase transition-colors"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {playlistData.entries.map((entry: any, i: number) => {
                    if (!entry) return null;
                    const id = entry.url || entry.id;
                    const isSelected = selectedPlaylistItems.has(id);
                    return (
                      <div
                        key={id}
                        onClick={() => {
                          const next = new Set(selectedPlaylistItems);
                          if (isSelected) next.delete(id);
                          else next.add(id);
                          setSelectedPlaylistItems(next);
                        }}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-blue-600/20 text-blue-200' : 'hover:bg-slate-800 text-slate-400'}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600'}`}>
                          {isSelected && <i className="fa-solid fa-check"></i>}
                        </div>
                        <span className="text-xs truncate flex-1 pr-2">{entry.title || `Video ${i + 1}`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {metadata && (!playlistData || !playlistData.entries || playlistData.entries.length === 0 || mode !== 'QUEUE') && (
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

            {metadataError && (
              <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 flex gap-3 animate-fadeIn">
                <div className="flex-shrink-0">
                  <div className="bg-amber-500/20 w-10 h-10 rounded-full flex items-center justify-center">
                    <i className="fa-solid fa-triangle-exclamation text-amber-400 text-lg"></i>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-amber-300 mb-1">Site Not Supported</h4>
                  <p className="text-xs text-amber-200/80 leading-relaxed">{metadataError}</p>
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

        <div className="mt-4 border-t border-slate-800 pt-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => setSponsorBlock(!sponsorBlock)}
              className={`w-10 h-5 rounded-full relative transition-colors ${sponsorBlock ? 'bg-green-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${sponsorBlock ? 'left-6' : 'left-1'}`}></div>
            </button>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none" onClick={() => setSponsorBlock(!sponsorBlock)}>
              Enable SponsorBlock
            </label>
          </div>

          {sponsorBlock && (
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 animate-fadeIn grid grid-cols-2 gap-2">
              {SPONSORBLOCK_CATEGORIES.map(cat => (
                <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    checked={sponsorBlockCategories.includes(cat.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSponsorBlockCategories([...sponsorBlockCategories, cat.id]);
                      } else {
                        setSponsorBlockCategories(sponsorBlockCategories.filter(c => c !== cat.id));
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <span className="text-xs text-slate-300">{cat.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
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
            {mode === 'SINGLE' ? (isProcessing ? 'Processing...' : 'Download Now') :
              (selectedPlaylistItems.size > 0 ? `Add ${selectedPlaylistItems.size} items to Queue` : 'Add to Queue')}
          </span>
        </button>
      </div>
    </form >
  );
};

export default DownloadForm;
