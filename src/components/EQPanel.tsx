import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

const FREQ_LABELS = ['Pre', '60', '170', '310', '600', '1k', '3k', '6k', '12k', '14k', '16k'];
const DEFAULT_GAINS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const PRESETS: Record<string, number[]> = {
  Default:              [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
  Classic:              [0,  0,  0,  0,  0,  0, -8, -8, -8, -8, -8],
  Dance:                [0, -8,  7,  7,  0,  0, -6, -8, -8,  0,  0],
  Club:                 [0,  0,  0,  8,  6,  2,  0,  0,  0,  0,  0],
  'Full Bass':          [0, -8,  9,  9,  5,  1, -4, -8, -8, -8, -8],
  'Full Bass & Treble': [0,  7,  5,  0, -7, -5,  2,  8,  8,  8,  9],
  'Full Treble':        [0, -9, -9, -9, -4,  3,  9,  9,  9,  9,  9],
  'Laptop Speakers':    [0, -3,  2,  4, 12, 10,  7,  2,  1, -2, -5],
  'Large Hall':         [0,  6,  6,  3,  3,  0, -2, -2, -2,  0,  0],
  Live:                 [0, -5,  0,  4,  5,  5,  5,  4,  2,  2,  2],
  Party:                [0,  7,  7,  0,  0,  0,  0,  0,  0,  7,  7],
  Pop:                  [0, -2,  4,  7,  8,  5,  0, -2, -2, -2, -2],
  Reggae:               [0,  0,  0,  0, -5,  0,  6,  6,  0,  0,  0],
  Rock:                 [0,  8,  5, -5, -8, -3,  4,  8,  8,  8,  8],
  Ska:                  [0, -2, -5, -4,  0,  4,  5,  8,  9,  9,  9],
  Soft:                 [0,  5,  2,  0, -2,  0,  4,  6,  7,  8,  9],
  'Soft Rock':          [0,  4,  4,  2,  0, -4, -6, -3,  0,  2,  8],
  'Techno Rock':        [0,  8,  5,  0, -5, -4,  0,  8,  9,  9,  8],
};

interface EQPanelProps {
  gains: number[];
  onGainsChange: (gains: number[]) => void;
}

export default function EQPanel({ gains, onGainsChange }: EQPanelProps): JSX.Element {
  const [preset, setPreset] = useState('Default');

  function handleSlider(index: number, value: number): void {
    const next = [...gains];
    next[index] = value;
    onGainsChange(next);
    setPreset('Custom');
  }

  function handlePreset(name: string): void {
    setPreset(name);
    onGainsChange([...(PRESETS[name] ?? DEFAULT_GAINS)]);
  }

  function handleReset(): void {
    setPreset('Default');
    onGainsChange([...DEFAULT_GAINS]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <select
          value={preset}
          onChange={(e) => handlePreset(e.target.value)}
          className="flex-1 bg-white/10 text-white text-xs rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-violet-500 transition"
        >
          {Object.keys(PRESETS).map((p) => (
            <option key={p} value={p} className="bg-neutral-800">{p}</option>
          ))}
          {preset === 'Custom' && (
            <option value="Custom" className="bg-neutral-800">Custom</option>
          )}
        </select>
        <button
          onClick={handleReset}
          title="Reset to flat"
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      <div className="flex gap-1.5 items-end justify-between h-36 px-1">
        {FREQ_LABELS.map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-white/60 text-[10px] tabular-nums w-5 text-center">
              {gains[i] > 0 ? `+${gains[i]}` : gains[i]}
            </span>
            <div className="relative flex-1 flex items-center justify-center w-full">
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={gains[i]}
                onChange={(e) => handleSlider(i, Number(e.target.value))}
                className="eq-slider"
                style={{
                  writingMode: 'vertical-lr' as const,
                  direction: 'rtl',
                  width: '100%',
                  height: '80px',
                  cursor: 'pointer',
                  accentColor: '#7c3aed',
                }}
              />
            </div>
            <span className="text-white/40 text-[9px] text-center">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
