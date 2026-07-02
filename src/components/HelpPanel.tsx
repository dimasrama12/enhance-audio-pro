import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Section {
  key: string;
  titleKey: string;
  contentKey: string;
}

const SECTIONS: Section[] = [
  { key: 'gettingStarted', titleKey: 'help.sections.gettingStarted', contentKey: 'help.sections.gettingStartedContent' },
  { key: 'enhance',        titleKey: 'help.sections.enhance',        contentKey: 'help.sections.enhanceContent' },
  { key: 'convert',        titleKey: 'help.sections.convert',        contentKey: 'help.sections.convertContent' },
  { key: 'manipulation',   titleKey: 'help.sections.manipulation',   contentKey: 'help.sections.manipulationContent' },
  { key: 'waveform',       titleKey: 'help.sections.waveform',       contentKey: 'help.sections.waveformContent' },
  { key: 'keyboard',       titleKey: 'help.sections.keyboard',       contentKey: 'help.sections.keyboardContent' },
];

function HelpSection({ section }: { section: Section }): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors"
      >
        <span>{t(section.titleKey)}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-3 text-xs text-white/50 leading-relaxed">
              {t(section.contentKey)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HelpPanel({ open, onClose }: Props): JSX.Element {
  const { t } = useTranslation();

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
            className="fixed right-0 top-0 bottom-0 w-96 bg-neutral-900 border-l border-white/10 z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="text-violet-400" />
                <h2 className="font-semibold">{t('help.title')}</h2>
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {SECTIONS.map((s) => (
                <HelpSection key={s.key} section={s} />
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
