import { useState } from 'react';
import { Play, Scissors, Search, Trash2 } from 'lucide-react';
import { useQueueStore } from '@/stores/useQueueStore';
import { invokeProcessQueue, invokeSeparateStems } from '@/lib/ipc';

const FILTERS = [
  { value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' }, { value: 'done', label: 'Done' },
  { value: 'error', label: 'Error' },
];

export default function QueueToolbar(): JSX.Element {
  const { filter, searchQuery, setFilter, setSearchQuery, clearQueue, jobs } = useQueueStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSeparating, setIsSeparating] = useState(false);

  const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
  const busy = isProcessing || isSeparating;
  const canAct = pendingIds.length > 0 && !busy;

  async function handleProcess(): Promise<void> {
    if (!canAct) return;
    setIsProcessing(true);
    try {
      await invokeProcessQueue(pendingIds);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSeparate(): Promise<void> {
    if (!canAct) return;
    setIsSeparating(true);
    try {
      await invokeSeparateStems(pendingIds);
    } finally {
      setIsSeparating(false);
    }
  }

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div className="relative flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-white/10 rounded-lg text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-violet-500 transition"
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
      <button
        onClick={handleProcess}
        disabled={!canAct}
        title="Enhance speech for pending files"
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white"
      >
        <Play size={14} />
        {isProcessing ? 'Enhancing…' : 'Enhance'}
      </button>
      <button
        onClick={handleSeparate}
        disabled={!canAct}
        title="Separate stems for pending files"
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white"
      >
        <Scissors size={14} />
        {isSeparating ? 'Separating…' : 'Separate Stems'}
      </button>
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
