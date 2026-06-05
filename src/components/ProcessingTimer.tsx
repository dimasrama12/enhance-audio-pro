import { useState, useEffect } from 'react';

interface ProcessingTimerProps {
  startedAt?: number;
}

export default function ProcessingTimer({ startedAt }: ProcessingTimerProps): JSX.Element | null {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    // Initial calculation
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));

    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');

  return (
    <span className="text-xs text-yellow-500/80 bg-yellow-500/10 px-2 py-0.5 rounded animate-pulse whitespace-nowrap tabular-nums">
      {m}:{s}
    </span>
  );
}
