import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveSettings } from '@/lib/ipc';
import type { AppSettings } from '@/types/settings';

interface Props { open: boolean; onClose: () => void; }

const LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'id', label: 'Indonesian' },
  { code: 'zh', label: 'Chinese' }, { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },  { code: 'fr', label: 'French' },
  { code: 'ja', label: 'Japanese' },
];

export default function SettingsPanel({ open, onClose }: Props): JSX.Element {
  const store = useSettingsStore();

  const save = async (patch: Partial<AppSettings>): Promise<void> => {
    const next: AppSettings = {
      theme: store.theme, outputFolder: store.outputFolder,
      language: store.language, setupComplete: store.setupComplete, ...patch,
    };
    store.setSettings(next);
    await invokeSaveSettings(next);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40"
          />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-80 bg-neutral-900 border-l border-white/10 z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-semibold">Settings</h2>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
              <section>
                <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">Appearance</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Theme</span>
                  <div className="flex rounded-lg overflow-hidden border border-white/20">
                    {(['dark', 'light'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => save({ theme: t })}
                        className={`px-3 py-1 text-xs capitalize transition-colors ${store.theme === t ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white'}`}
                      >{t}</button>
                    ))}
                  </div>
                </div>
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">Output</h3>
                <label className="text-sm block mb-2">Default Output Folder</label>
                <input
                  type="text" readOnly value={store.outputFolder || 'Not set'}
                  className="w-full px-3 py-1.5 bg-white/10 rounded-lg text-sm text-white/60 outline-none"
                />
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">Language</h3>
                <select
                  value={store.language}
                  onChange={(e) => save({ language: e.target.value })}
                  className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-neutral-800">{l.label}</option>
                  ))}
                </select>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
