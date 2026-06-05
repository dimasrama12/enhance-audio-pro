import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useToastStore } from '@/stores/useToastStore';

const TOAST_STYLES = {
  success: {
    wrap: 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200',
    icon: <CheckCircle size={16} className="shrink-0 mt-0.5 text-emerald-500 dark:text-emerald-400" />,
  },
  error: {
    wrap: 'bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-200',
    icon: <XCircle size={16} className="shrink-0 mt-0.5 text-red-500 dark:text-red-400" />,
  },
  info: {
    wrap: 'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-200',
    icon: <Info size={16} className="shrink-0 mt-0.5 text-blue-500 dark:text-blue-400" />,
  },
};

export default function ToastContainer(): JSX.Element {
  const { toasts, dismissToast } = useToastStore();

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={[
                'pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm max-w-xs',
                'border backdrop-blur-sm',
                style.wrap,
              ].join(' ')}
            >
              {style.icon}
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity mt-0.5"
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
