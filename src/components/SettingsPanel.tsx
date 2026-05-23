import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderOpen } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveSettings } from '@/lib/ipc';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import type { AppSettings } from '@/types/settings';
import KeyboardShortcutsPanel from '@/components/KeyboardShortcutsPanel';

interface Props { open: boolean; onClose: () => void; }

export default function SettingsPanel({ open, onClose }: Props): JSX.Element {
  const store = useSettingsStore();
  const { t } = useTranslation();

  const browseFolder = async (): Promise<void> => {
    const selected = await openDialog({ directory: true, multiple: false, title: 'Select Output Folder' });
    if (typeof selected === 'string' && selected) {
      await save({ outputFolder: selected });
    }
  };

  const save = async (patch: Partial<AppSettings>): Promise<void> => {
    const next: AppSettings = {
      theme: store.theme,
      outputFolder: store.outputFolder,
      language: store.language,
      setupComplete: store.setupComplete,
      enhancementStrength: store.enhancementStrength,
      filenameTemplate: store.filenameTemplate,
      keyboardShortcuts: store.keyboardShortcuts,
      ...patch,
    };
    store.setSettings(next);
    if (patch.language) i18n.changeLanguage(patch.language);
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
              <h2 className="font-semibold">{t('settings.title')}</h2>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
              <section>
                <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">{t('settings.appearance')}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('settings.theme')}</span>
                  <div className="flex rounded-lg overflow-hidden border border-white/20">
                    {(['dark', 'light'] as const).map((th) => (
                      <button
                        key={th}
                        onClick={() => save({ theme: th })}
                        className={`px-3 py-1 text-xs capitalize transition-colors ${store.theme === th ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white'}`}
                      >{t(`settings.${th}`)}</button>
                    ))}
                  </div>
                </div>
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">{t('settings.enhancement')}</h3>
                <label className="text-sm block mb-2">{t('settings.strengthLabel')}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={store.enhancementStrength}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      store.setEnhancementStrength(v);
                      save({ enhancementStrength: v });
                    }}
                    className="flex-1 accent-violet-500"
                  />
                  <span className="text-sm text-white/60 w-8 text-right tabular-nums">
                    {store.enhancementStrength}
                  </span>
                </div>
                <p className="text-[10px] text-white/30 mt-1">{t('settings.strengthHint')}</p>
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">{t('settings.output')}</h3>
                <label className="text-sm block mb-2">{t('settings.outputFolder')}</label>
                <div className="flex gap-2">
                  <input
                    type="text" readOnly value={store.outputFolder || t('settings.notSet')}
                    className="flex-1 px-3 py-1.5 bg-white/10 rounded-lg text-sm text-white/60 outline-none truncate"
                  />
                  <button
                    onClick={browseFolder}
                    title="Browse folder"
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors shrink-0"
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">Output Filename</h3>
                <label className="text-sm block mb-2">Template</label>
                <input
                  type="text"
                  value={store.filenameTemplate}
                  onChange={(e) => save({ filenameTemplate: e.target.value })}
                  placeholder="{name}_enhanced"
                  className="w-full px-3 py-1.5 bg-white/10 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-violet-500 transition"
                />
                <p className="text-[10px] text-white/30 mt-1">Tokens: <code>{'{name}'}</code>, <code>{'{date}'}</code>, <code>{'{format}'}</code></p>
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">{t('settings.language')}</h3>
                <select
                  value={store.language}
                  onChange={(e) => save({ language: e.target.value })}
                  className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-neutral-800">{l.label}</option>
                  ))}
                </select>
              </section>
              <KeyboardShortcutsPanel />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
