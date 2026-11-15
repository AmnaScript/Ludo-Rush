import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Maximize2, Menu, Minimize2, Volume2, VolumeX, X } from 'lucide-react';
import { isMuted, play, setMuted, subscribeMute } from '../audio/sfx';
import { useConnectionStore } from '../store/connectionStore';

/**
 * One-screen game layout: the board fills the window, the dice dock floats
 * above it (so nobody scrolls to roll), and players / chat live in a side
 * panel. A button switches the browser to real fullscreen.
 */
export function GameStage({
  color,
  title,
  subtitle,
  board,
  dock,
  side,
  sideLabel = 'Players & chat',
}: {
  color: string;
  title: string;
  subtitle?: string;
  board: ReactNode;
  dock?: ReactNode;
  side: ReactNode;
  sideLabel?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [open, setOpen] = useState(false);
  const muted = useSyncExternalStore(subscribeMute, isMuted);
  const connected = useConnectionStore((s) => s.connected);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.().catch(() => undefined);
  };

  const btn = 'rounded-full bg-white/95 p-2.5 text-[#223748] shadow-md hover:bg-white';

  return (
    <div ref={root} className="fixed inset-0 z-30 flex bg-[#fff3db] text-[#223748]">
      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-0">{board}</div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2 sm:p-3">
          <div className="pointer-events-auto flex min-w-0 items-center gap-2.5 rounded-2xl bg-white/95 px-3 py-2 shadow-md">
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-white shadow" style={{ backgroundColor: color }} />
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-tight sm:text-base">{title}</p>
              {subtitle && <p className="truncate text-xs text-[#71828c]">{subtitle}</p>}
            </div>
          </div>

          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
            <span
              title={connected ? 'Online' : 'Offline'}
              className={`h-3 w-3 rounded-full border-2 border-white shadow ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`}
            />
            <button type="button" className={btn} title={muted ? 'Unmute' : 'Mute'} onClick={() => { setMuted(!muted); if (muted) play('click'); }}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button type="button" className={btn} title={full ? 'Exit full screen' : 'Full screen'} onClick={toggleFull}>
              {full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button type="button" className={`${btn} lg:hidden`} title={sideLabel} onClick={() => setOpen(true)}>
              <Menu size={18} />
            </button>
          </div>
        </div>

        {dock && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
            <div className="pointer-events-auto flex items-center gap-3 rounded-3xl border-4 border-white bg-white/95 p-2.5 pr-4 shadow-2xl">
              {dock}
            </div>
          </div>
        )}
      </div>

      {/* desktop side panel */}
      {wide && (
        <aside className="w-[340px] shrink-0 space-y-3 overflow-y-auto border-l-4 border-white bg-[#fff3db] p-3">
          {side}
        </aside>
      )}

      {/* mobile drawer */}
      {!wide && open && (
        <div className="absolute inset-0 z-20 flex flex-col bg-[#fff3db] lg:hidden">
          <div className="flex items-center justify-between p-3">
            <p className="font-black">{sideLabel}</p>
            <button type="button" className={btn} onClick={() => setOpen(false)} aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3 pt-0">{side}</div>
        </div>
      )}
    </div>
  );
}
