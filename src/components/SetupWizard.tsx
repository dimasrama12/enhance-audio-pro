import { useEffect, useRef, useState } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Wand2 } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeStartModelDownload, invokeSaveSettings } from '@/lib/ipc';

type WizardState = 'idle' | 'downloading' | 'error';

export default function SetupWizard(): JSX.Element {
  const [wizardState, setWizardState] = useState<WizardState>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const unlistenRef = useRef<UnlistenFn[]>([]);
  const store = useSettingsStore();

  useEffect(() => {
    return () => {
      unlistenRef.current.forEach((fn) => fn());
    };
  }, []);

  async function handleStart(): Promise<void> {
    setWizardState('downloading');
    setProgress(0);
    setStatusMessage('Starting download…');
    setErrorMessage('');

    const unlistenProgress = await listen<{ percent: number; message: string }>(
      'wizard://progress',
      (event) => {
        setProgress(event.payload.percent);
        setStatusMessage(event.payload.message);
      }
    );

    const unlistenComplete = await listen<{ message: string }>(
      'wizard://complete',
      async () => {
        setProgress(100);
        setStatusMessage('Models ready!');
        store.markSetupComplete();
        await invokeSaveSettings({
          theme: store.theme,
          outputFolder: store.outputFolder,
          language: store.language,
          setupComplete: true,
          enhancementStrength: store.enhancementStrength,
          filenameTemplate: store.filenameTemplate,
          filenameTemplateConverted: store.filenameTemplateConverted,
          keyboardShortcuts: store.keyboardShortcuts,
          recordingPrefix: store.recordingPrefix ?? 'Record',
          aiModel: store.aiModel ?? 'deepfilternet',
          scratchDiskDir: store.scratchDiskDir,
          customDefaultShortcuts: store.customDefaultShortcuts,
        });
      }
    );

    const unlistenError = await listen<{ message: string }>(
      'wizard://error',
      (event) => {
        setWizardState('error');
        setErrorMessage(event.payload.message);
      }
    );

    unlistenRef.current = [unlistenProgress, unlistenComplete, unlistenError];

    await invokeStartModelDownload();
  }

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
            <div className="flex justify-between">
              <span>DeepFilterNet (noise removal)</span>
              <span>~200 MB</span>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {wizardState === 'downloading' && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col gap-2"
            >
              <div className="flex justify-between text-xs text-white/50">
                <span>{statusMessage}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-violet-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          )}

          {wizardState === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full flex items-start gap-2 p-3 rounded-xl bg-red-500/10 text-red-400 text-xs text-left"
            >
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={wizardState === 'error' ? handleStart : handleStart}
          disabled={wizardState === 'downloading'}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {wizardState === 'idle' && 'Get Started'}
          {wizardState === 'downloading' && 'Downloading…'}
          {wizardState === 'error' && 'Retry'}
        </button>
      </motion.div>
    </div>
  );
}
