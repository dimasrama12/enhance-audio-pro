import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, FolderOpen, Download, CheckCircle2, AlertCircle,
  Settings, HelpCircle, Keyboard, Disc, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveSettings, invokeStartModelDownload, invokeCheckModelStatus } from '@/lib/ipc';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import type { AppSettings } from '@/types/settings';
import { SHORTCUT_LABELS, DEFAULT_KEYBOARD_SHORTCUTS } from '@/types/settings';
import type { KeyboardShortcutMap } from '@/types/settings';

// ─── Types ───────────────────────────────────────────────────────────────────

type SettingsTab = 'general' | 'guide' | 'shortcuts' | 'formats';
type DownloadState = 'idle' | 'checking' | 'installed' | 'downloading' | 'error';
interface Props { open: boolean; onClose: () => void; }

// ─── Guide tab ────────────────────────────────────────────────────────────────

const GUIDE_SECTIONS = [
  { key: 'start',    title: 'Getting Started',       content: 'Drop audio or video files onto the drop zone, or click the folder icon in the toolbar to browse. Files are added to the queue and ready for processing.' },
  { key: 'enhance',  title: 'Speech Enhancement',    content: 'Select pending files and click Enhance to apply AI-powered noise removal using DeepFilterNet3. Adjust the strength slider in General → Enhancement.' },
  { key: 'separate', title: 'Stem Separation',       content: 'Use Separate Stems to split audio into vocals, drums, bass, and other stems via the Demucs htdemucs_ft model. Output stems are saved to your output folder.' },
  { key: 'convert',  title: 'Format Conversion',     content: 'Convert between MP3, WAV, FLAC, AAC, OGG, OPUS, and M4A. Set a global format with the All→ selector in the toolbar, or change individual files in the queue.' },
  { key: 'manip',    title: 'Audio Manipulation',    content: 'Select a job and use the manipulation panel below the queue for Trim, Speed, Pitch, Volume, Fade In/Out, Merge, Loop, and an 11-band EQ.' },
  { key: 'wave',     title: 'Waveform & Playback',   content: 'Click a completed job to open the waveform player. Use the A/B toggle to compare original and enhanced audio in real-time.' },
  { key: 'record',   title: 'Recording',             content: 'Click the microphone icon in the toolbar to record audio directly from your default input device. The recording is added to the queue when you stop.' },
];

function GuideSection({ title, content }: { title: string; content: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors"
      >
        <span>{title}</span>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.15 }} className="overflow-hidden"
          >
            <p className="px-4 pb-3 text-xs text-white/50 leading-relaxed">{content}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
      <p className="text-xs text-white/40 mb-2">Click a binding to record a new shortcut. Press Escape to cancel.</p>
      {(Object.keys(SHORTCUT_LABELS) as (keyof KeyboardShortcutMap)[]).map((key) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <span className="text-xs text-white/60 flex-1 truncate">{SHORTCUT_LABELS[key]}</span>
          <button
            onClick={() => startRecording(key)}
            className={`min-w-[90px] text-center px-2 py-1 rounded text-xs font-mono border transition-colors ${
              recording === key
                ? 'border-violet-500 bg-violet-600/20 text-violet-300 animate-pulse'
                : 'border-white/20 bg-white/5 text-white/70 hover:border-violet-500/60 hover:text-white'
            }`}
          >
            {recording === key ? 'Press key…' : (keyboardShortcuts?.[key] ?? DEFAULT_KEYBOARD_SHORTCUTS[key])}
          </button>
        </div>
      ))}
      <button
        onClick={() => setKeyboardShortcuts({ ...DEFAULT_KEYBOARD_SHORTCUTS })}
        className="mt-3 text-xs text-white/30 hover:text-white/60 transition-colors self-end"
      >
        Reset all to defaults
      </button>
    </div>
  );
}

// ─── Formats tab ──────────────────────────────────────────────────────────────

const AUDIO_FORMATS = [
  { ext: 'MP3',  desc: 'Lossy, universal compatibility' },
  { ext: 'WAV',  desc: 'Lossless PCM, studio quality' },
  { ext: 'FLAC', desc: 'Lossless compressed' },
  { ext: 'AAC',  desc: 'Lossy, high efficiency' },
  { ext: 'OGG',  desc: 'Lossy, open source' },
  { ext: 'OPUS', desc: 'Lossy, low latency' },
  { ext: 'M4A',  desc: 'AAC in MPEG-4 container' },
  { ext: 'WMA',  desc: 'Windows Media Audio' },
  { ext: 'AIFF', desc: 'Apple lossless PCM' },
  { ext: 'MP2',  desc: 'MPEG-1 Audio Layer II' },
];

const VIDEO_FORMATS = [
  { ext: 'MP4',  desc: 'H.264/H.265, universal' },
  { ext: 'MKV',  desc: 'Matroska, multi-track' },
  { ext: 'MOV',  desc: 'QuickTime, Apple native' },
  { ext: 'AVI',  desc: 'Audio Video Interleave' },
  { ext: 'WebM', desc: 'VP8/VP9, web optimised' },
  { ext: 'FLV',  desc: 'Flash Video, legacy' },
];

function FormatsTab(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h4 className="text-xs font-semibold uppercase text-white/40 mb-3">Audio</h4>
        <div className="grid grid-cols-2 gap-2">
          {AUDIO_FORMATS.map(({ ext, desc }) => (
            <div key={ext} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
              <span className="text-xs font-mono font-bold text-violet-400 w-10 shrink-0">{ext}</span>
              <span className="text-xs text-white/40">{desc}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase text-white/40 mb-3">Video (audio extraction)</h4>
        <div className="grid grid-cols-2 gap-2">
          {VIDEO_FORMATS.map(({ ext, desc }) => (
            <div key={ext} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
              <span className="text-xs font-mono font-bold text-teal-400 w-10 shrink-0">{ext}</span>
              <span className="text-xs text-white/40">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const TABS: Array<{ id: SettingsTab; label: string; Icon: LucideIcon }> = [
  { id: 'general',   label: 'General',        Icon: Settings    },
  { id: 'guide',     label: 'User Guide',     Icon: HelpCircle  },
  { id: 'shortcuts', label: 'Shortcuts',      Icon: Keyboard    },
  { id: 'formats',   label: 'Formats',        Icon: Disc        },
];

export default function SettingsPanel({ open, onClose }: Props): JSX.Element {
  const store = useSettingsStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [dlState, setDlState] = useState<DownloadState>('idle');
  const [dlProgress, setDlProgress] = useState(0);
  const [dlMessage, setDlMessage] = useState('');
  const [dlError, setDlError] = useState('');
  const unlistenRef = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    return () => { unlistenRef.current.forEach((fn) => fn()); };
  }, []);

  useEffect(() => {
    if (open && dlState === 'idle') {
      setDlState('checking');
      invokeCheckModelStatus()
        .then((res) => setDlState(res.data === true ? 'installed' : 'idle'))
        .catch(() => setDlState('idle'));
    }
  }, [open]);

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

  async function handleDownload(): Promise<void> {
    setDlState('downloading');
    setDlProgress(0);
    setDlMessage('Starting download…');
    setDlError('');
    const unP = await listen<{ percent: number; message: string }>('wizard://progress', (e) => {
      setDlProgress(e.payload.percent);
      setDlMessage(e.payload.message);
    });
    const unC = await listen<{ message: string }>('wizard://complete', () => {
      setDlProgress(100);
      setDlMessage('Models ready!');
      setDlState('installed');
    });
    const unE = await listen<{ message: string }>('wizard://error', (e) => {
      setDlState('error');
      setDlError(e.payload.message);
    });
    unlistenRef.current = [unP, unC, unE];
    await invokeStartModelDownload();
  }

  const browseFolder = async (): Promise<void> => {
    const selected = await openDialog({ directory: true, multiple: false, title: 'Select Output Folder' });
    if (typeof selected === 'string' && selected) await save({ outputFolder: selected });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          />

          {/* Centered modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="pointer-events-auto w-[700px] max-h-[78vh] bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0">
                <h2 className="font-semibold text-sm">{t('settings.title')}</h2>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Tab bar */}
              <div className="flex border-b border-white/10 shrink-0 px-4 gap-1">
                {TABS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === id
                        ? 'border-violet-500 text-violet-400'
                        : 'border-transparent text-white/40 hover:text-white/70'
                    }`}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-5">

                {/* ── General ──────────────────────────────────────────── */}
                {activeTab === 'general' && (
                  <div className="flex flex-col gap-5">
                    <section>
                      <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">{t('settings.appearance')}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{t('settings.theme')}</span>
                        <div className="flex rounded-lg overflow-hidden border border-white/20">
                          {(['dark', 'light'] as const).map((th) => (
                            <button
                              key={th}
                              onClick={() => save({ theme: th })}
                              className={`px-4 py-1.5 text-xs capitalize transition-colors ${
                                store.theme === th
                                  ? 'bg-violet-600 text-white'
                                  : 'text-white/50 hover:text-white'
                              }`}
                            >
                              {t(`settings.${th}`)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">{t('settings.enhancement')}</h3>
                      <label className="text-sm block mb-2">{t('settings.strengthLabel')}</label>
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
                          type="text" readOnly
                          value={store.outputFolder || t('settings.notSet')}
                          className="flex-1 px-3 py-1.5 bg-white/10 rounded-lg text-sm text-white/60 outline-none truncate"
                        />
                        <button
                          onClick={browseFolder}
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
                      <p className="text-[10px] text-white/30 mt-1">
                        Tokens: <code>{'{name}'}</code>, <code>{'{date}'}</code>, <code>{'{format}'}</code>
                      </p>
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

                    <section>
                      <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">AI Models</h3>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between text-sm">
                          <span>DeepFilterNet (noise removal)</span>
                          <span className="text-white/40 text-xs">~200 MB</span>
                        </div>
                        {dlState === 'checking' && (
                          <p className="text-xs text-white/40">Checking…</p>
                        )}
                        {dlState === 'installed' && (
                          <div className="flex items-center gap-2 text-emerald-400 text-xs">
                            <CheckCircle2 size={14} />
                            <span>Installed — D:\enhance-audio-pro-data\models</span>
                          </div>
                        )}
                        {(dlState === 'idle' || dlState === 'error') && (
                          <>
                            {dlState === 'error' && (
                              <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">
                                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                                <span>{dlError}</span>
                              </div>
                            )}
                            <button
                              onClick={handleDownload}
                              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors"
                            >
                              <Download size={14} />
                              {dlState === 'error' ? 'Retry Download' : 'Download Model'}
                            </button>
                          </>
                        )}
                        {dlState === 'downloading' && (
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-xs text-white/50">
                              <span>{dlMessage}</span>
                              <span>{dlProgress}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-violet-500"
                                animate={{ width: `${dlProgress}%` }}
                                transition={{ duration: 0.4, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                )}

                {/* ── User Guide ───────────────────────────────────────── */}
                {activeTab === 'guide' && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-white/40 mb-1">Quick reference for all major features.</p>
                    {GUIDE_SECTIONS.map((s) => (
                      <GuideSection key={s.key} title={s.title} content={s.content} />
                    ))}
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
