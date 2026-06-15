import { useState } from 'react';
import { Keyboard } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { SHORTCUT_LABELS, DEFAULT_KEYBOARD_SHORTCUTS } from '@/types/settings';
import type { KeyboardShortcutMap } from '@/types/settings';
import { invokeSaveSettings } from '@/lib/ipc';

// Use e.code to get the physical key so Shift+1 resolves to '1' not '!'
function resolveMainKey(e: KeyboardEvent): string {
  const code = e.code;
  if (code.startsWith('Digit')) return code.slice(5); // 'Digit1' → '1'
  if (code.startsWith('Key')) return code.slice(3);   // 'KeyA' → 'A'
  const key = e.key;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return '';
  return key.length === 1 ? key.toUpperCase() : key;
}

function formatKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  const key = resolveMainKey(e);
  if (key) parts.push(key);
  return parts.join('+');
}

export default function KeyboardShortcutsPanel(): JSX.Element {
  const { keyboardShortcuts, setKeyboardShortcuts } = useSettingsStore();
  const [recording, setRecording] = useState<keyof KeyboardShortcutMap | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  const [tempCombo, setTempCombo] = useState<string | null>(null);

  function startRecording(key: keyof KeyboardShortcutMap): void {
    setRecording(key);
    setTempCombo(null);

    const handler = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecording(null);
        setTempCombo(null);
        window.removeEventListener('keydown', handler, true);
        return;
      }

      const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);
      const combo = formatKey(e);

      if (!isModifier) {
        if (combo) {
          const current = {
            ...DEFAULT_KEYBOARD_SHORTCUTS,
            ...(keyboardShortcuts ?? {}),
          };
          const updated = { ...(keyboardShortcuts ?? {}) };

          // Clear duplicates
          Object.keys(current).forEach((k) => {
            const otherKey = k as keyof KeyboardShortcutMap;
            if (otherKey !== key) {
              const activeCombo = keyboardShortcuts?.[otherKey] ?? DEFAULT_KEYBOARD_SHORTCUTS[otherKey];
              if (activeCombo?.toLowerCase() === combo.toLowerCase()) {
                updated[otherKey] = '';
              }
            }
          });

          updated[key] = combo;
          setKeyboardShortcuts(updated);

          // Save settings to storage & disk
          const settings = useSettingsStore.getState();
          const nextSettings = {
            theme: settings.theme,
            outputFolder: settings.outputFolder,
            language: settings.language,
            setupComplete: settings.setupComplete,
            enhancementStrength: settings.enhancementStrength,
            filenameTemplate: settings.filenameTemplate,
            keyboardShortcuts: updated,
            recordingPrefix: settings.recordingPrefix ?? 'Record',
            aiModel: settings.aiModel ?? 'deepfilternet',
          };
          settings.setSettings(nextSettings);
          void invokeSaveSettings(nextSettings);
        }
        setRecording(null);
        setTempCombo(null);
        window.removeEventListener('keydown', handler, true);
      } else {
        setTempCombo(combo + '+...');
      }
    };

    window.addEventListener('keydown', handler, true);
  }

  async function resetAll(): Promise<void> {
    setKeyboardShortcuts({ ...DEFAULT_KEYBOARD_SHORTCUTS });
    const settings = useSettingsStore.getState();
    const nextSettings = {
      theme: settings.theme,
      outputFolder: settings.outputFolder,
      language: settings.language,
      setupComplete: settings.setupComplete,
      enhancementStrength: settings.enhancementStrength,
      filenameTemplate: settings.filenameTemplate,
      keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
      recordingPrefix: settings.recordingPrefix ?? 'Record',
      aiModel: settings.aiModel ?? 'deepfilternet',
    };
    settings.setSettings(nextSettings);
    await invokeSaveSettings(nextSettings);
  }

  return (
    <section>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between w-full text-xs font-semibold uppercase text-white/40 mb-3 hover:text-white/60 transition-colors"
      >
        <span className="flex items-center gap-2"><Keyboard size={12} /> Keyboard Shortcuts</span>
        <span className="text-white/30">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-1.5">
          {(Object.keys(SHORTCUT_LABELS) as (keyof KeyboardShortcutMap)[]).map((key) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-white/60 flex-1 truncate">{SHORTCUT_LABELS[key]}</span>
              <button
                onClick={() => startRecording(key)}
                title="Click to record new shortcut"
                className={`min-w-[80px] text-center px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
                  recording === key
                    ? 'border-violet-500 bg-violet-600/20 text-violet-300 animate-pulse'
                    : 'border-white/20 bg-white/5 text-white/70 hover:border-violet-500/60 hover:text-white'
                }`}
              >
                {recording === key 
                  ? (tempCombo ?? 'Press key…') 
                  : (keyboardShortcuts?.[key] === '' 
                    ? 'None' 
                    : (keyboardShortcuts?.[key] ?? DEFAULT_KEYBOARD_SHORTCUTS[key])
                  )
                }
              </button>
            </div>
          ))}
          <button
            onClick={resetAll}
            className="mt-2 text-xs text-white/30 hover:text-white/60 transition-colors self-end"
          >
            Reset to defaults
          </button>

          {/* Queue — fixed shortcuts */}
          <div className="mt-3 pt-3 border-t border-white/10">
            <span className="text-[10px] font-semibold uppercase text-white/30 mb-2 block tracking-wider">
              Queue (fixed)
            </span>
            {([
              ['Click + Drag', 'Marquee select multiple items'],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs text-white/50 flex-1 truncate">{label}</span>
                <span className="min-w-[80px] text-center px-2 py-0.5 rounded text-xs font-mono border border-white/10 bg-white/[0.03] text-white/40">
                  {key}
                </span>
              </div>
            ))}
          </div>

          {/* Waveform Player — fixed shortcuts (info only, active when player is focused) */}
          <div className="mt-3 pt-3 border-t border-white/10">
            <span className="text-[10px] font-semibold uppercase text-white/30 mb-2 block tracking-wider">
              Waveform Player (fixed)
            </span>
            {([
              ['Space', 'Play / Pause (or stop accelerated mode)'],
              ['← →', 'Skip −1s / +1s'],
              ['Shift + ← / →', 'Skip −5s / +5s'],
              ['Ctrl + ← / →', 'Go to start / end of audio'],
              ['Left Shift', 'One frame backward (1/30 s)'],
              ['Right Shift', 'One frame forward (1/30 s)'],
              ['J', 'Step back: 4x → 2x → 1x → 0 → −2x → −4x'],
              ['L', 'Step forward: −4x → −2x → 0 → 2x → 4x'],
              ['J / L interact', 'Bidirectional speed control'],
              ['↑ / ↓', 'Volume +1 dB / −1 dB (+10 dB to −40 dB)'],
              ['W', 'Close waveform player'],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs text-white/50 flex-1 truncate">{label}</span>
                <span className="min-w-[80px] text-center px-2 py-0.5 rounded text-xs font-mono border border-white/10 bg-white/[0.03] text-white/40">
                  {key}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
