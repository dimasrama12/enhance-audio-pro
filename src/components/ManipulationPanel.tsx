import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scissors, Gauge, Music, Volume2, Waves, GitMerge, Repeat, SlidersHorizontal, X } from 'lucide-react';
import { useQueueStore } from '@/stores/useQueueStore';
import { invokeManipulateAudio, invokeMergeAudio, invokeLoopAudio, invokeApplyEQ } from '@/lib/ipc';
import EQPanel from '@/components/EQPanel';

type Tab = 'trim' | 'speed' | 'pitch' | 'volume' | 'fade' | 'merge' | 'loop' | 'eq';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'trim',   label: 'Trim',   icon: <Scissors size={12} /> },
  { id: 'speed',  label: 'Speed',  icon: <Gauge size={12} /> },
  { id: 'pitch',  label: 'Pitch',  icon: <Music size={12} /> },
  { id: 'volume', label: 'Volume', icon: <Volume2 size={12} /> },
  { id: 'fade',   label: 'Fade',   icon: <Waves size={12} /> },
  { id: 'merge',  label: 'Merge',  icon: <GitMerge size={12} /> },
  { id: 'loop',   label: 'Loop',   icon: <Repeat size={12} /> },
  { id: 'eq',     label: 'EQ',     icon: <SlidersHorizontal size={12} /> },
];

function NumInput({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  onChange: (v: number) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1 flex-1">
      <span className="text-white/40 text-[10px] uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-white/10 text-white text-xs rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-violet-500 transition"
        />
        {unit && <span className="text-white/30 text-[10px]">{unit}</span>}
      </div>
    </div>
  );
}

function ApplyButton({ onClick, label = 'Apply' }: { onClick: () => void; label?: string }): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors"
    >
      {label}
    </button>
  );
}

export default function ManipulationPanel(): JSX.Element {
  const jobs = useQueueStore((s) => s.jobs);
  const selectedJobId = useQueueStore((s) => s.selectedJobId);
  const setSelectedJob = useQueueStore((s) => s.setSelectedJob);

  const [tab, setTab] = useState<Tab>('trim');

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(30);
  const [speed, setSpeed] = useState(1.0);
  const [semitones, setSemitones] = useState(0);
  const [dbGain, setDbGain] = useState(0);
  const [fadeIn, setFadeIn] = useState(2);
  const [fadeOut, setFadeOut] = useState(2);
  const [fadeDuration, setFadeDuration] = useState(60);
  const [crossfade, setCrossfade] = useState(0);
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [loopHours, setLoopHours] = useState(1);
  const [eqGains, setEqGains] = useState<number[]>(Array(11).fill(0));

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null;

  async function applyTrim(): Promise<void> {
    if (!selectedJobId) return;
    await invokeManipulateAudio(selectedJobId, 'trim', { start_sec: trimStart, end_sec: trimEnd });
  }

  async function applySpeed(): Promise<void> {
    if (!selectedJobId) return;
    await invokeManipulateAudio(selectedJobId, 'speed', { speed_factor: speed });
  }

  async function applyPitch(): Promise<void> {
    if (!selectedJobId) return;
    await invokeManipulateAudio(selectedJobId, 'pitch', { semitones });
  }

  async function applyVolume(): Promise<void> {
    if (!selectedJobId) return;
    await invokeManipulateAudio(selectedJobId, 'volume', { db_gain: dbGain });
  }

  async function applyFade(): Promise<void> {
    if (!selectedJobId) return;
    await invokeManipulateAudio(selectedJobId, 'fade', {
      fade_in_sec: fadeIn,
      fade_out_sec: fadeOut,
      duration_sec: fadeDuration,
    });
  }

  async function applyMerge(): Promise<void> {
    if (!selectedJobId) return;
    const ids = [selectedJobId, ...mergeIds.filter((id) => id !== selectedJobId)];
    if (ids.length < 2) return;
    await invokeMergeAudio(ids, crossfade);
  }

  async function applyLoop(): Promise<void> {
    if (!selectedJobId) return;
    await invokeLoopAudio(selectedJobId, loopHours * 3600);
  }

  async function applyEQ(): Promise<void> {
    if (!selectedJobId) return;
    await invokeApplyEQ(selectedJobId, eqGains);
  }

  function toggleMergeId(id: string): void {
    setMergeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <AnimatePresence>
      {selectedJob && (
        <motion.div
          key="manipulation-panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">
                <span className="text-violet-400 font-medium">{selectedJob.filename}</span>
                {' '}— manipulation tools
              </span>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded-md text-white/30 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                    tab === id
                      ? 'bg-violet-600 text-white'
                      : 'text-white/50 hover:text-white hover:bg-white/10',
                  ].join(' ')}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex items-end gap-3 flex-wrap">
              {tab === 'trim' && (
                <>
                  <NumInput label="Start" value={trimStart} min={0} max={9999} step={0.1} unit="s" onChange={setTrimStart} />
                  <NumInput label="End" value={trimEnd} min={0} max={9999} step={0.1} unit="s" onChange={setTrimEnd} />
                  <ApplyButton onClick={applyTrim} />
                </>
              )}
              {tab === 'speed' && (
                <>
                  <NumInput label="Speed" value={speed} min={0.25} max={4.0} step={0.05} unit="×" onChange={setSpeed} />
                  <ApplyButton onClick={applySpeed} />
                </>
              )}
              {tab === 'pitch' && (
                <>
                  <NumInput label="Semitones" value={semitones} min={-24} max={24} step={1} unit="st" onChange={setSemitones} />
                  <ApplyButton onClick={applyPitch} />
                </>
              )}
              {tab === 'volume' && (
                <>
                  <NumInput label="Gain" value={dbGain} min={-40} max={40} step={0.5} unit="dB" onChange={setDbGain} />
                  <ApplyButton onClick={applyVolume} />
                </>
              )}
              {tab === 'fade' && (
                <>
                  <NumInput label="Fade In" value={fadeIn} min={0} max={60} step={0.5} unit="s" onChange={setFadeIn} />
                  <NumInput label="Fade Out" value={fadeOut} min={0} max={60} step={0.5} unit="s" onChange={setFadeOut} />
                  <NumInput label="Duration" value={fadeDuration} min={1} max={99999} step={1} unit="s" onChange={setFadeDuration} />
                  <ApplyButton onClick={applyFade} />
                </>
              )}
              {tab === 'merge' && (
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex flex-wrap gap-1.5">
                    {jobs
                      .filter((j) => j.id !== selectedJobId)
                      .map((j) => (
                        <button
                          key={j.id}
                          onClick={() => toggleMergeId(j.id)}
                          className={[
                            'px-2 py-0.5 rounded text-xs transition-colors',
                            mergeIds.includes(j.id)
                              ? 'bg-violet-600 text-white'
                              : 'bg-white/10 text-white/50 hover:text-white',
                          ].join(' ')}
                        >
                          {j.filename}
                        </button>
                      ))}
                    {jobs.length <= 1 && (
                      <span className="text-white/30 text-xs">Add more files to the queue to merge.</span>
                    )}
                  </div>
                  <div className="flex items-end gap-3">
                    <NumInput label="Crossfade" value={crossfade} min={0} max={10} step={0.1} unit="s" onChange={setCrossfade} />
                    <ApplyButton onClick={applyMerge} label="Merge" />
                  </div>
                </div>
              )}
              {tab === 'loop' && (
                <>
                  <NumInput label="Duration" value={loopHours} min={0.1} max={24} step={0.5} unit="h" onChange={setLoopHours} />
                  <ApplyButton onClick={applyLoop} label="Generate Loop" />
                </>
              )}
              {tab === 'eq' && (
                <div className="w-full flex flex-col gap-2">
                  <EQPanel gains={eqGains} onGainsChange={setEqGains} />
                  <div className="flex justify-end">
                    <ApplyButton onClick={applyEQ} label="Apply EQ" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
