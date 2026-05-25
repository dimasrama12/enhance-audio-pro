import { useState } from 'react';
import { Music, Video, Settings, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import HistoryPanel from '@/components/HistoryPanel';
import { useUIStore, type AppTab } from '@/stores/useUIStore';

export default function Sidebar(): JSX.Element {
  const { activeTab, setActiveTab, openSettings } = useUIStore();
  const [historyOpen, setHistoryOpen] = useState(false);

  const tabs: { id: AppTab; label: string; Icon: typeof Music }[] = [
    { id: 'audio', label: 'Audio', Icon: Music },
    { id: 'video', label: 'Video', Icon: Video },
  ];

  return (
    <>
      <aside className="flex flex-col w-16 bg-neutral-950 items-center py-4 gap-2 shrink-0">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              'flex flex-col items-center gap-1 p-2 rounded-lg w-12 transition-colors',
              activeTab === id ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
            )}
          >
            <Icon size={18} />
            <span className="text-[9px] font-medium">{label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            historyOpen ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
          )}
          title="Recent files"
        >
          <Clock size={18} />
        </button>
        <button
          onClick={openSettings}
          className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          title="Settings (Ctrl+,)"
        >
          <Settings size={18} />
        </button>
      </aside>
      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  );
}
