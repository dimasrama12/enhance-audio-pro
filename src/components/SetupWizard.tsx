import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2 } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveSettings } from '@/lib/ipc';

export default function SetupWizard(): JSX.Element {
  const [loading, setLoading] = useState(false);
  const store = useSettingsStore();

  const handleStart = async (): Promise<void> => {
    setLoading(true);
    // Phase 2: replace with real model download + progress events from Python
    await new Promise<void>((r) => setTimeout(r, 600));
    store.markSetupComplete();
    await invokeSaveSettings({
      theme: store.theme,
      outputFolder: store.outputFolder,
      language: store.language,
      setupComplete: true,
    });
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-neutral-900 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 max-w-sm w-full text-center px-4"
      >
        <div className="p-4 rounded-2xl bg-violet-600/20">
          <Wand2 size={40} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">Welcome to Enhance Audio Pro</h1>
          <p className="text-white/50 text-sm">AI-powered audio enhancement — fully offline.</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 w-full text-left">
          <h3 className="text-sm font-semibold mb-3">Required AI Models</h3>
          <div className="flex flex-col gap-2 text-xs text-white/60">
            <div className="flex justify-between"><span>DeepFilterNet (noise removal)</span><span>~200 MB</span></div>
            <div className="flex justify-between"><span>Demucs htdemucs (stem separation)</span><span>~83 MB</span></div>
          </div>
          <p className="text-xs text-white/30 mt-3">Model download wires up in Phase 2.</p>
        </div>
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {loading ? 'Setting up…' : 'Get Started'}
        </button>
      </motion.div>
    </div>
  );
}
