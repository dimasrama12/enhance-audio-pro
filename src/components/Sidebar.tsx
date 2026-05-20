import { useState } from 'react';
import { Music, Video, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import SettingsPanel from '@/components/SettingsPanel';

type Tab = 'audio' | 'video';

export default function Sidebar(): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('audio');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tabs: { id: Tab; label: string; Icon: typeof Music }[] = [
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
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Settings size={18} />
        </button>
      </aside>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
