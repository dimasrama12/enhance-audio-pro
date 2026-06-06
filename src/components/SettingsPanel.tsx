import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, FolderOpen, Settings, HelpCircle, Keyboard, Disc,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveSettings, invokeSaveScratchDiskDir } from '@/lib/ipc';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import type { AppSettings } from '@/types/settings';
import { SHORTCUT_LABELS, DEFAULT_KEYBOARD_SHORTCUTS } from '@/types/settings';
import type { KeyboardShortcutMap } from '@/types/settings';

// ─── Types ───────────────────────────────────────────────────────────────────

type SettingsTab = 'general' | 'guide' | 'shortcuts' | 'formats';
interface Props { open: boolean; onClose: () => void; }

// ─── Shortcuts tab ────────────────────────────────────────────────────────────

function formatKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  const key = e.key;
  if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
    parts.push(key.length === 1 ? key.toUpperCase() : key);
  }
  return parts.join('+');
}

function ShortcutsTab(): JSX.Element {
  const { keyboardShortcuts, setKeyboardShortcuts } = useSettingsStore();
  const [recording, setRecording] = useState<keyof KeyboardShortcutMap | null>(null);

  function startRecording(key: keyof KeyboardShortcutMap): void {
    setRecording(key);
    const handler = (e: KeyboardEvent): void => {
      e.preventDefault();
      if (e.key === 'Escape') {
        setRecording(null);
        window.removeEventListener('keydown', handler, true);
        return;
      }
      const combo = formatKey(e);
      if (combo) setKeyboardShortcuts({ ...keyboardShortcuts, [key]: combo });
      setRecording(null);
      window.removeEventListener('keydown', handler, true);
    };
    window.addEventListener('keydown', handler, true);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-400 dark:text-white/40 mb-2">Click a binding to record a new shortcut. Press Escape to cancel.</p>
      {(Object.keys(SHORTCUT_LABELS) as (keyof KeyboardShortcutMap)[]).map((key) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-600 dark:text-white/60 flex-1 truncate">{SHORTCUT_LABELS[key]}</span>
          <button
            onClick={() => startRecording(key)}
            className={`min-w-[90px] text-center px-2 py-1 rounded-lg text-xs font-mono border transition-colors ${recording === key
                ? 'border-violet-500 bg-violet-600/15 text-violet-500 dark:text-violet-300 animate-pulse'
                : 'border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-white/60 hover:border-violet-400/60 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            {recording === key ? 'Press key…' : (keyboardShortcuts?.[key] ?? DEFAULT_KEYBOARD_SHORTCUTS[key])}
          </button>
        </div>
      ))}
      <button
        onClick={() => setKeyboardShortcuts({ ...DEFAULT_KEYBOARD_SHORTCUTS })}
        className="mt-3 text-xs text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white/60 transition-colors self-end"
      >
        Reset all to defaults
      </button>
    </div>
  );
}

// ─── Formats tab ──────────────────────────────────────────────────────────────

const AUDIO_FORMATS = [
  { ext: 'MP3', desc: 'Lossy, universal compatibility' },
  { ext: 'WAV', desc: 'Lossless PCM, studio quality' },
  { ext: 'FLAC', desc: 'Lossless compressed' },
  { ext: 'AAC', desc: 'Lossy, high efficiency' },
  { ext: 'OGG', desc: 'Lossy, open source' },
  { ext: 'OPUS', desc: 'Lossy, low latency' },
  { ext: 'M4A', desc: 'AAC in MPEG-4 container' },
  { ext: 'WMA', desc: 'Windows Media Audio' },
  { ext: 'AIFF', desc: 'Apple lossless PCM' },
  { ext: 'MP2', desc: 'MPEG-1 Audio Layer II' },
];

const VIDEO_FORMATS = [
  { ext: 'MP4', desc: 'H.264/H.265, universal' },
  { ext: 'MKV', desc: 'Matroska, multi-track' },
  { ext: 'MOV', desc: 'QuickTime, Apple native' },
  { ext: 'AVI', desc: 'Audio Video Interleave' },
  { ext: 'WebM', desc: 'VP8/VP9, web optimised' },
  { ext: 'FLV', desc: 'Flash Video, legacy' },
];

function FormatsTab(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/40 mb-3">Audio</h4>
        <div className="grid grid-cols-2 gap-2">
          {AUDIO_FORMATS.map(({ ext, desc }) => (
            <div key={ext} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06]">
              <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400 w-10 shrink-0">{ext}</span>
              <span className="text-xs text-slate-500 dark:text-white/40">{desc}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/40 mb-3">Video (audio extraction)</h4>
        <div className="grid grid-cols-2 gap-2">
          {VIDEO_FORMATS.map(({ ext, desc }) => (
            <div key={ext} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06]">
              <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400 w-10 shrink-0">{ext}</span>
              <span className="text-xs text-slate-500 dark:text-white/40">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-3 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06]">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-white/30">{title}</h3>
      {children}
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const TABS: Array<{ id: SettingsTab; label: string; Icon: LucideIcon }> = [
  { id: 'general', label: 'General', Icon: Settings },
  { id: 'guide', label: 'User Guide', Icon: HelpCircle },
  { id: 'shortcuts', label: 'Shortcuts', Icon: Keyboard },
  { id: 'formats', label: 'Formats', Icon: Disc },
];

export default function SettingsPanel({ open, onClose }: Props): JSX.Element {
  const store = useSettingsStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const save = async (patch: Partial<AppSettings>): Promise<void> => {
    const next: AppSettings = {
      theme: store.theme,
      outputFolder: store.outputFolder,
      language: store.language,
      setupComplete: store.setupComplete,
      enhancementStrength: store.enhancementStrength,
      filenameTemplate: store.filenameTemplate,
      keyboardShortcuts: store.keyboardShortcuts,
      recordingPrefix: store.recordingPrefix ?? 'Record',
      aiModel: store.aiModel ?? 'deepfilternet',
      ...patch,
    };
    store.setSettings(next);
    if (patch.language) i18n.changeLanguage(patch.language);
    await invokeSaveSettings(next);
  };

  const browseFolder = async (): Promise<void> => {
    const selected = await openDialog({ directory: true, multiple: false, title: 'Select Output Folder' });
    if (typeof selected === 'string' && selected) await save({ outputFolder: selected });
  };

  const browseScratchDisk = async (): Promise<void> => {
    const selected = await openDialog({ directory: true, multiple: false, title: 'Select Scratch Disk / Cache Directory' });
    if (typeof selected === 'string' && selected) {
      store.setScratchDiskDir(selected);
      await save({ scratchDiskDir: selected });
      await invokeSaveScratchDiskDir(selected);
    }
  };

  const clearScratchDisk = async (): Promise<void> => {
    store.setScratchDiskDir('');
    await save({ scratchDiskDir: '' });
    await invokeSaveScratchDiskDir('');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Centered modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="pointer-events-auto w-[430px] max-h-[78vh] bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-white/[0.06] shrink-0">
                <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{t('settings.title')}</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Tab bar — underline style */}
              <div className="flex border-b border-slate-200 dark:border-white/[0.06] shrink-0 px-4 gap-0.5">
                {TABS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-all duration-150 ${activeTab === id
                        ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                        : 'border-transparent text-slate-400 dark:text-white/35 hover:text-slate-700 dark:hover:text-white/65'
                      }`}
                  >
                    <Icon size={11} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto scrollbar-hide p-4">

                {/* ── General ──────────────────────────────────────────── */}
                {activeTab === 'general' && (
                  <div className="flex flex-col gap-3">
                    <Section title={t('settings.appearance')}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-900 dark:text-slate-100">{t('settings.theme')}</span>
                        <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-white/[0.10]">
                          {(['dark', 'light'] as const).map((th) => (
                            <button
                              key={th}
                              onClick={() => save({ theme: th })}
                              className={`px-4 py-1.5 text-xs capitalize transition-colors ${store.theme === th
                                  ? 'bg-violet-600 text-white'
                                  : 'text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                              {t(`settings.${th}`)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </Section>

                    <Section title={t('settings.enhancement')}>
                      <label className="text-sm text-slate-900 dark:text-slate-100">{t('settings.strengthLabel')}</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range" min={0} max={100} step={1}
                          value={store.enhancementStrength}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            store.setEnhancementStrength(v);
                            save({ enhancementStrength: v });
                          }}
                          className="flex-1 accent-violet-500"
                        />
                        <span className="text-sm text-slate-500 dark:text-white/60 w-8 text-right tabular-nums">
                          {store.enhancementStrength}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-white/30">{t('settings.strengthHint')}</p>

                      <label className="text-sm text-slate-900 dark:text-slate-100 mt-2">AI Enhancement Model</label>
                      <div className="flex gap-2">
                        {(['deepfilternet', 'lavasr'] as const).map((model) => (
                          <button
                            key={model}
                            onClick={() => save({ aiModel: model })}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs capitalize transition-colors border ${store.aiModel === model
                                ? 'bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400'
                                : 'bg-transparent border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-white/50 hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                              }`}
                          >
                            {model === 'deepfilternet' ? 'V1 (DeepFilterNet)' : 'V2 (LavaSR)'}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-white/30">V1 is stable for noise reduction. V2 is faster and provides superior speech quality.</p>
                    </Section>

                    <Section title={t('settings.output')}>
                      <label className="text-sm text-slate-900 dark:text-slate-100">{t('settings.outputFolder')}</label>
                      <div className="flex gap-2">
                        <input
                          type="text" readOnly
                          value={store.outputFolder || t('settings.notSet')}
                          className="flex-1 px-3 py-1.5 bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] rounded-lg text-sm text-slate-500 dark:text-white/50 outline-none truncate"
                        />
                        <button
                          onClick={browseFolder}
                          className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.10] text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                        >
                          <FolderOpen size={15} />
                        </button>
                      </div>

                      <label className="text-sm text-slate-900 dark:text-slate-100 mt-1">Output Filename Template</label>
                      <input
                        type="text"
                        value={store.filenameTemplate}
                        onChange={(e) => save({ filenameTemplate: e.target.value })}
                        placeholder="{name}_enhanced"
                        className="w-full px-3 py-1.5 bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-violet-500 transition"
                      />
                      <p className="text-[10px] text-slate-400 dark:text-white/30">
                        Tokens: <code className="font-mono">{'{name}'}</code>, <code className="font-mono">{'{date}'}</code>, <code className="font-mono">{'{format}'}</code>
                      </p>

                      <label className="text-sm text-slate-900 dark:text-slate-100 mt-1">Recording Name Prefix</label>
                      <input
                        type="text"
                        value={store.recordingPrefix ?? 'Record'}
                        onChange={(e) => save({ recordingPrefix: e.target.value || 'Record' })}
                        placeholder="Record"
                        className="w-full px-3 py-1.5 bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-violet-500 transition"
                      />
                      <p className="text-[10px] text-slate-400 dark:text-white/30">
                        Recorded files are named <code className="font-mono">01_Record.wav</code> using this prefix.
                      </p>

                      <label className="text-sm text-slate-900 dark:text-slate-100 mt-1">Scratch Disk / Cache Directory</label>
                      <div className="flex gap-2">
                        <input
                          type="text" readOnly
                          value={store.scratchDiskDir || 'System default (C: drive)'}
                          className="flex-1 px-3 py-1.5 bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] rounded-lg text-sm text-slate-500 dark:text-white/50 outline-none truncate"
                        />
                        <button
                          onClick={browseScratchDisk}
                          className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.10] text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                          title="Browse for scratch disk directory"
                        >
                          <FolderOpen size={15} />
                        </button>
                        {store.scratchDiskDir && (
                          <button
                            onClick={clearScratchDisk}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-red-100 dark:hover:bg-red-900/20 text-slate-500 dark:text-white/50 hover:text-red-600 dark:hover:text-red-400 transition-colors shrink-0"
                            title="Reset to system default"
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-white/30">
                        Redirect temp processing files (e.g. <code className="font-mono">D:\</code>) to save C: drive space. Takes effect after restart.
                      </p>
                    </Section>

                    <Section title={t('settings.language')}>
                      <select
                        value={store.language}
                        onChange={(e) => save({ language: e.target.value })}
                        className="w-full bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-200 dark:border-white/[0.08] focus:ring-1 focus:ring-violet-500 transition"
                      >
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code} className="bg-white dark:bg-[#0D1422]">{l.label}</option>
                        ))}
                      </select>
                    </Section>
                  </div>
                )}

                {/* ── User Guide ───────────────────────────────────────── */}
                {activeTab === 'guide' && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white/80 mb-3">{t('guide.title')}</h4>
                    <p className="text-sm text-slate-500 dark:text-white/50 leading-relaxed">{t('guide.content')}</p>
                  </div>
                )}

                {/* ── Keyboard Shortcuts ───────────────────────────────── */}
                {activeTab === 'shortcuts' && <ShortcutsTab />}

                {/* ── Supported Formats ────────────────────────────────── */}
                {activeTab === 'formats' && <FormatsTab />}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
