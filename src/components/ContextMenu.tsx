import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function ContextMenu(): JSX.Element | null {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const menuWidth = 160;
      const menuHeight = 40;
      let x = e.clientX;
      let y = e.clientY;
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
      if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;
      setMenu({ x, y });
    };

    const handleClick = () => {
      setMenu(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null);
      }
    };

    const handleScroll = () => {
      setMenu(null);
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  if (!menu) return null;

  return (
    <div
      className="fixed z-[9999] bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.08] rounded-lg shadow-xl py-1 w-40 overflow-hidden backdrop-blur-md select-none"
      style={{ left: menu.x, top: menu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => {
          window.location.reload();
        }}
        className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 flex items-center justify-between transition-colors duration-100 group"
      >
        <span className="flex items-center gap-2">
          <RefreshCw size={12} className="text-slate-400 group-hover:text-white transition-colors" />
          Refresh
        </span>
        <span className="text-[10px] text-slate-400 dark:text-white/30 group-hover:text-white/70 font-mono">
          Ctrl+R
        </span>
      </button>
    </div>
  );
}
