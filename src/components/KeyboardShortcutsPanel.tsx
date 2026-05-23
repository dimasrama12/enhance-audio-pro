import { useState } from 'react';
import { Keyboard } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { SHORTCUT_LABELS, DEFAULT_KEYBOARD_SHORTCUTS } from '@/types/settings';
import type { KeyboardShortcutMap } from '@/types/settings';

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

export default function KeyboardShortcutsPanel(): JSX.Element {
  const { keyboardShortcuts, setKeyboardShortcuts } = useSettingsStore();
  const [recording, setRecording] = useState<keyof KeyboardShortcutMap | null>(null);
  const [collapsed, setCollapsed] = useState(true);

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
      if (combo) {
        setKeyboardShortcuts({ ...keyboardShortcuts, [key]: combo });
      }
      setRecording(null);
      window.removeEventListener('keydown', handler, true);
    };
    window.addEventListener('keydown', handler, true);
  }

  function resetAll(): void {
    setKeyboardShortcuts({ ...DEFAULT_KEYBOARD_SHORTCUTS });
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
                {recording === key ? 'Press key…' : (keyboardShortcuts?.[key] ?? DEFAULT_KEYBOARD_SHORTCUTS[key])}
              </button>
            </div>
          ))}
          <button
            onClick={resetAll}
            className="mt-2 text-xs text-white/30 hover:text-white/60 transition-colors self-end"
          >
            Reset to defaults
          </button>
        </div>
      )}
    </section>
  );
}
