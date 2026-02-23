
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

const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'flac', 'aac', 'opus', 'ogg', 'm4r'];

const DownloadForm: React.FC<Props> = ({ onAdd, onAddMultiple, isProcessing, mode, settings, sharedDestination, setSharedDestination, onClear }) => {
  const [url, setUrl] = useState('');
  const [referer, setReferer] = useState('');
  const [filename, setFilename] = useState('');
  const [extraArgs, setExtraArgs] = useState('');
  const [format, setFormat] = useState('mp4');
  const [resolution, setResolution] = useState('best');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [fetchingPlaylist, setFetchingPlaylist] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [playlistData, setPlaylistData] = useState<any>(null);
  const [selectedPlaylistItems, setSelectedPlaylistItems] = useState<Set<string>>(new Set());
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [availableResolutions, setAvailableResolutions] = useState<string[]>(['best', '2160p', '1440p', '1080p', '720p', '480p', '360p']);
  const [availableFormats, setAvailableFormats] = useState<string[]>(['mp4', 'mkv', 'webm', 'mp3', 'm4a', 'opus']);
  const [sponsorBlock, setSponsorBlock] = useState(false);
  const [sponsorBlockCategories, setSponsorBlockCategories] = useState<string[]>(['music_offtopic']);

  const videoFormats = availableFormats.filter(ext => !AUDIO_EXTENSIONS.includes(ext.toLowerCase()));
  const audioFormats = availableFormats.filter(ext => AUDIO_EXTENSIONS.includes(ext.toLowerCase()));

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

          if (data && data.entries) {
            // Deduplicate and filter entries
            const seenIds = new Set();
            const filteredEntries = data.entries.filter((e: any) => {
              if (!e) return false;
              const id = e.id || e.url;
              if (!id || seenIds.has(id)) return false;

              // Filter out unavailable/private videos
              const title = (e.title || "").toLowerCase();
              if (title.includes("[private video]") ||
                title.includes("[deleted video]") ||
                title.includes("unavailable video") ||
                title.includes("[hidden video]")) {
                return false;
              }

              seenIds.add(id);
              return true;
            });

            data.entries = filteredEntries;
            setPlaylistData(data);
            setSelectedPlaylistItems(new Set());
            setShowPlaylistModal(true);
          } else {
            setPlaylistData(data);
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
          // Add common conversion formats manually 
          extSet.add('mp3');
          extSet.add('opus');
          extSet.add('m4a');
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
      const selectedEntries = playlistData.entries.filter((e: any) => e && selectedPlaylistItems.has(e.id || e.url));
      const items = selectedEntries.map((e: any) => ({
        url: e.url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : ''),
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
    setShowPlaylistModal(false);
    setPlaylistSearch('');
    onClear?.();
  };

  const applyPreset = (args: string) => {
    setExtraArgs(args);
  };

  const filteredPlaylistEntries = playlistData?.entries?.filter((e: any) =>
    !playlistSearch.trim() ||
    (e.title || "").toLowerCase().includes(playlistSearch.toLowerCase())
  ) || [];

  return (
    <div className="relative">
      {/* Playlist Selection Modal */}
      {showPlaylistModal && playlistData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/20 w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl dark:shadow-blue-900/40 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-blue-600/10 p-2 rounded-xl">
                    <i className="fa-solid fa-list-ul text-blue-500 text-xl"></i>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white truncate">
                    {playlistData.title || 'Playlist Selection'}
                  </h3>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <span>{playlistData.entries.length} videos found</span>
                  <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                  <span className="text-blue-500">{selectedPlaylistItems.size} selected for download</span>
                </p>
              </div>
              <button
                onClick={() => setShowPlaylistModal(false)}
                className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-all border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="p-6 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 group">
                  <input
                    type="text"
                    value={playlistSearch}
                    onChange={(e) => setPlaylistSearch(e.target.value)}
                    placeholder="Search videos in playlist..."
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm pr-12 text-slate-900 dark:text-white shadow-sm"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400">
                    <i className="fa-solid fa-magnifying-glass"></i>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set(selectedPlaylistItems);
                      filteredPlaylistEntries.forEach((e: any) => next.add(e.id || e.url));
                      setSelectedPlaylistItems(next);
                    }}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-xs transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                  >
                    <i className="fa-solid fa-check-double"></i>
                    {playlistSearch.trim() ? 'Select Found' : 'Select All'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!playlistSearch.trim()) {
                        setSelectedPlaylistItems(new Set());
                      } else {
                        const next = new Set(selectedPlaylistItems);
                        filteredPlaylistEntries.forEach((e: any) => next.delete(e.id || e.url));
                        setSelectedPlaylistItems(next);
                      }
                    }}
                    className="px-4 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs transition-all active:scale-95 flex items-center gap-2"
                  >
                    <i className="fa-solid fa-eraser"></i>
                    {playlistSearch.trim() ? 'Clear Found' : 'Clear Selection'}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Quick Pick:</span>
                {[10, 25, 50, 100].map(count => (
                  <button
                    key={count}
                    type="button"
                    disabled={playlistData.entries.length < count}
                    onClick={() => {
                      const ids = playlistData.entries.slice(0, count).map((e: any) => e.id || e.url);
                      setSelectedPlaylistItems(new Set(ids));
                    }}
                    className="text-[10px] bg-white dark:bg-slate-800 hover:bg-blue-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all font-bold"
                  >
                    Top {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-3 custom-scrollbar">
              {filteredPlaylistEntries.length > 0 ? (
                filteredPlaylistEntries.map((entry: any, i: number) => {
                  const id = entry.id || entry.url;
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
                      className={`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border-2 ${isSelected
                        ? 'bg-blue-600/10 border-blue-500/40'
                        : 'bg-white dark:bg-slate-800/40 border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                      <div className={`shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 shadow-inner'
                        }`}>
                        {isSelected && <i className="fa-solid fa-check text-[10px]"></i>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold truncate ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                          {entry.title || `Video ${i + 1}`}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-500 font-mono mt-0.5 truncate uppercase tracking-tighter">
                          {entry.uploader ? `By ${entry.uploader}` : (entry.id || 'Unknown ID')}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                  <div className="bg-slate-100 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mb-4 text-3xl">
                    <i className="fa-solid fa-magnifying-glass"></i>
                  </div>
                  <p className="font-bold">No videos match your search</p>
                  <button
                    onClick={() => setPlaylistSearch('')}
                    className="mt-4 text-blue-500 hover:underline text-sm font-bold"
                  >
                    Clear Filter
                  </button>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
              <button
                onClick={() => setShowPlaylistModal(false)}
                className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                Back to URL
              </button>
              <button
                disabled={selectedPlaylistItems.size === 0}
                onClick={handleSubmit}
                className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
              >
                <i className="fa-solid fa-plus"></i>
                Add {selectedPlaylistItems.size} items to Queue
              </button>
            </div>
          </div>
        </div>
      )}

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
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 transition-all text-sm pr-10 text-slate-900 dark:text-white"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <i className="fa-solid fa-link text-slate-400 dark:text-slate-600"></i>
            </div>
          </div>
        </div>

        {
          (fetchingMetadata || fetchingPlaylist) ? (
            <div className="bg-slate-50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-700 p-8 rounded-2xl flex flex-col items-center justify-center animate-pulse-slow">
              <div className="bg-blue-600/10 dark:bg-blue-600/20 p-4 rounded-full mb-4">
                <i className="fa-solid fa-wand-magic-sparkles text-blue-500 dark:text-blue-400 text-2xl animate-bounce"></i>
              </div>
              <h4 className="text-slate-700 dark:text-slate-300 font-bold mb-1">
                {fetchingPlaylist ? 'Analyzing Playlist...' : 'Analyzing Media...'}
              </h4>
              <p className="text-slate-500 text-xs">This may take a few seconds...</p>
            </div>
          ) : (
            <>
              {playlistData && playlistData.entries && playlistData.entries.length > 0 && mode === 'QUEUE' && (
                <div className="animate-fadeIn mb-5">
                  <button
                    type="button"
                    onClick={() => setShowPlaylistModal(true)}
                    className="w-full bg-blue-600/10 hover:bg-blue-600/20 border-2 border-dashed border-blue-500/30 rounded-2xl p-4 flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:rotate-6 transition-transform">
                        <i className="fa-solid fa-list-check text-white"></i>
                      </div>
                      <div className="text-left">
                        <h4 className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight">Manage Playlist</h4>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                          {selectedPlaylistItems.size} of {playlistData.entries.length} videos selected
                        </p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-blue-500/20 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2 shadow-sm">
                      Open Selector
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </div>
                  </button>
                </div>
              )}

              {metadata && (!playlistData || !playlistData.entries || playlistData.entries.length === 0 || mode !== 'QUEUE') && (
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3 flex gap-4 animate-fadeIn shadow-inner">
                  {metadata.thumbnail && (
                    <img src={metadata.thumbnail} alt="" className="w-24 h-16 object-cover rounded-lg shadow-md" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{metadata.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 truncate">{metadata.uploader || metadata.webpage_url_domain}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-mono">
                        {metadata.duration_string || 'N/A'}
                      </span>
                      <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 font-mono">
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
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 transition-colors ${AUDIO_EXTENSIONS.includes(format.toLowerCase()) ? 'text-slate-600' : 'text-slate-400'}`}>
                    Resolution
                  </label>
                  <div className="relative">
                    <select
                      value={resolution}
                      onChange={e => setResolution(e.target.value)}
                      disabled={AUDIO_EXTENSIONS.includes(format.toLowerCase())}
                      className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-950 text-slate-900 dark:text-white`}
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
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer text-slate-900 dark:text-white"
                    >
                      {videoFormats.length > 0 && (
                        <optgroup label="─── 📹 VIDEO FORMATS ───">
                          {videoFormats.map(ext => (
                            <option key={ext} value={ext}>{ext.toUpperCase()}</option>
                          ))}
                        </optgroup>
                      )}
                      {audioFormats.length > 0 && (
                        <optgroup label="─── 🎵 AUDIO FORMATS ───">
                          {audioFormats.sort((a, b) => {
                            // Sort opus first
                            if (a === 'opus') return -1;
                            if (b === 'opus') return 1;
                            return 0;
                          }).map(ext => (
                            <option key={ext} value={ext}>
                              {ext === 'opus' ? 'OPUS (Highest Quality - Recommended)' :
                                ext === 'm4a' ? 'M4A (High Compatibility)' :
                                  ext === 'mp3' ? 'MP3 (Universal Standard)' :
                                    ext === 'flac' ? 'FLAC (Compressed Lossless)' :
                                      ext === 'wav' ? 'WAV (Uncompressed Lossless)' :
                                        ext.toUpperCase()}
                            </option>
                          ))}
                        </optgroup>
                      )}
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
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 transition-all text-sm pr-10 text-slate-900 dark:text-white"
                  />
                  <i className="fa-solid fa-file-signature absolute right-4 top-1/2 -translate-y-1/2 text-slate-600"></i>
                </div>
              </div>
            </>
          )
        }

        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Advanced Options</label>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`text-[10px] font-extrabold px-3 py-1 rounded-full transition-all tracking-tighter ${showAdvanced ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
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
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 transition-all text-sm pr-10 text-slate-900 dark:text-white"
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
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 transition-all text-sm font-mono resize-none shadow-inner text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {settings.presets.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.args)}
                    className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full text-slate-600 dark:text-slate-300 font-medium transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/50 transition-all">
              <button
                type="button"
                onClick={() => setSponsorBlock(!sponsorBlock)}
                className={`w-10 h-5 rounded-full relative transition-all ${sponsorBlock ? 'bg-green-500 shadow-lg shadow-green-500/30' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all shadow-sm ${sponsorBlock ? 'left-6' : 'left-1'}`}></div>
              </button>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer select-none" onClick={() => setSponsorBlock(!sponsorBlock)}>
                Enable SponsorBlock
              </label>
            </div>

            {sponsorBlock && (
              <div className="bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 animate-fadeIn grid grid-cols-2 gap-2 shadow-sm">
                {SPONSORBLOCK_CATEGORIES.map(cat => (
                  <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-xl transition-all group">
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
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-white dark:focus:ring-offset-slate-900 cursor-pointer"
                    />
                    <span className="text-xs text-slate-700 dark:text-slate-300">{cat.label}</span>
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
            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all relative overflow-hidden group ${isProcessing && mode === 'SINGLE'
              ? 'bg-slate-200 dark:bg-slate-800 cursor-not-allowed text-slate-400 dark:text-slate-600'
              : mode === 'SINGLE'
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/30 dark:shadow-blue-900/40 active:scale-[0.98]'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/30 dark:shadow-indigo-900/40 active:scale-[0.98]'
              }`}
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <i className={`fa-solid ${mode === 'SINGLE' ? 'fa-download' : 'fa-plus'} relative z-10 ${isProcessing && mode === 'SINGLE' ? 'animate-bounce' : ''}`}></i>
            <span className="relative z-10">
              {mode === 'SINGLE' ? (isProcessing ? 'Processing...' : 'Download Now') :
                (selectedPlaylistItems.size > 0 ? `Add ${selectedPlaylistItems.size} items to Queue` : 'Add to Queue')}
            </span>
          </button>
        </div>
      </form >
    </div>
  );
};

export default DownloadForm;
