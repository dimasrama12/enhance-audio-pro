import { useState } from 'react';
import { Play, Scissors, Search, Trash2, RefreshCw, LayoutList, LayoutGrid, FolderOpen, Layers } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import RecordButton from '@/components/RecordButton';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  invokeAddFiles,
  invokeProcessQueue,
  invokeSeparateStems,
  invokeConvertFiles,
  invokeSetOutputFormat,
} from '@/lib/ipc';
import type { ViewMode } from '@/stores/useQueueStore';

const FILTERS = [
  { value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' }, { value: 'done', label: 'Done' },
  { value: 'error', label: 'Error' },
];

const FORMAT_OPTIONS = ['wav', 'mp3', 'flac', 'aac', 'ogg', 'opus', 'm4a'];

export default function QueueToolbar(): JSX.Element {
  const { filter, searchQuery, setFilter, setSearchQuery, clearQueue, jobs, addJobs, setOutputFormat, viewMode, setViewMode, groupByFormat, setGroupByFormat } =
    useQueueStore();
  const enhancementStrength = useSettingsStore((s) => s.enhancementStrength);
  const filenameTemplate = useSettingsStore((s) => s.filenameTemplate);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSeparating, setIsSeparating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [globalFormat, setGlobalFormat] = useState('wav');

  const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
  const busy = isProcessing || isSeparating || isConverting;
  const canAct = pendingIds.length > 0 && !busy;

  async function handleProcess(): Promise<void> {
    if (!canAct) return;
    setIsProcessing(true);
    try { await invokeProcessQueue(pendingIds, enhancementStrength); } finally { setIsProcessing(false); }
  }

  async function handleSeparate(): Promise<void> {
    if (!canAct) return;
    setIsSeparating(true);
    try { await invokeSeparateStems(pendingIds); } finally { setIsSeparating(false); }
  }

  async function handleConvert(): Promise<void> {
    if (!canAct) return;
    setIsConverting(true);
    try { await invokeConvertFiles(pendingIds, filenameTemplate); } finally { setIsConverting(false); }
  }

  async function handleOpenFiles(): Promise<void> {
    const selected = await open({
      multiple: true,
      filters: [{ name: 'Audio / Video', extensions: ['mp3','wav','flac','aac','ogg','opus','m4a','wma','mp4','mkv','mov','avi','webm','flv'] }],
      title: 'Add Files to Queue',
    });
    const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
    if (paths.length === 0) return;
    const res = await invokeAddFiles(paths);
    if (res.success && res.data) addJobs(res.data);
  }

  async function handleApplyFormat(): Promise<void> {
    const pendingJobs = jobs.filter((j) => j.status === 'pending');
    await Promise.all(
      pendingJobs.map((j) => {
        setOutputFormat(j.id, globalFormat);
        return invokeSetOutputFormat(j.id, globalFormat);
      })
    );
  }

  function toggleView(): void {
    const next: ViewMode = viewMode === 'table' ? 'grid' : 'table';
    setViewMode(next);
  }

  return (
    <div className="flex items-center gap-2 shrink-0 flex-wrap">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 pr-3 py-1.5 bg-white/10 rounded-lg text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-violet-500 transition w-40"
        />
      </div>
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="bg-white/10 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-violet-500 transition"
      >
        {FILTERS.map((f) => (
          <option key={f.value} value={f.value} className="bg-neutral-800">{f.label}</option>
        ))}
      </select>
      <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
        <span className="text-white/40 text-xs">All→</span>
        <select
          value={globalFormat}
          onChange={(e) => setGlobalFormat(e.target.value)}
          className="bg-transparent text-white text-xs outline-none"
        >
          {FORMAT_OPTIONS.map((f) => (
            <option key={f} value={f} className="bg-neutral-800">{f.toUpperCase()}</option>
          ))}
        </select>
        <button
          onClick={handleApplyFormat}
          disabled={pendingIds.length === 0}
          title="Apply format to all pending files"
          className="text-white/60 hover:text-white disabled:opacity-40 transition"
        >
          <RefreshCw size={12} />
        </button>
      </div>
      <button
        onClick={handleProcess}
        disabled={!canAct}
        title="Enhance speech [E]"
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white"
      >
        <Play size={14} />
        {isProcessing ? 'Enhancing…' : 'Enhance'}
      </button>
      <button
        onClick={handleSeparate}
        disabled={!canAct}
        title="Separate stems [S]"
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white"
      >
        <Scissors size={14} />
        {isSeparating ? 'Separating…' : 'Separate Stems'}
      </button>
      <button
        onClick={handleConvert}
        disabled={!canAct}
        title="Convert format [C]"
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white"
      >
        <RefreshCw size={14} />
        {isConverting ? 'Converting…' : 'Convert'}
      </button>
      <button
        onClick={toggleView}
        title={viewMode === 'table' ? 'Switch to grid view' : 'Switch to table view'}
        className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
      >
        {viewMode === 'table' ? <LayoutGrid size={16} /> : <LayoutList size={16} />}
      </button>
      <button
        onClick={handleOpenFiles}
        title="Open files [Ctrl+O]"
        className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
      >
        <FolderOpen size={16} />
      </button>
      <button
        onClick={() => setGroupByFormat(!groupByFormat)}
        title={groupByFormat ? 'Ungroup by format' : 'Group by format'}
        className={`p-2 rounded-lg transition-colors ${groupByFormat ? 'text-violet-400 bg-violet-600/20' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
      >
        <Layers size={16} />
      </button>
      <RecordButton />
      <button
        onClick={clearQueue}
        title="Clear queue"
        className="p-2 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-colors"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
