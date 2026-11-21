import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Maximize2, Menu, Minimize2, PanelRightClose, PanelRightOpen, Volume2, VolumeX, X } from 'lucide-react';
import { isMuted, play, setMuted, subscribeMute } from '../audio/sfx';
import { useConnectionStore } from '../store/connectionStore';

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const fsElement = () => document.fullscreenElement ?? (document as FsDoc).webkitFullscreenElement ?? null;

/**
 * One-screen game layout: the board fills the window, the turn dock floats on
 * it (nobody scrolls to roll), and players / chat live in a side panel.
 * Full screen uses the browser API; where the browser blocks it (for example
 * inside the VS Code Simple Browser) it falls back to "focus mode", which
 * hides the side panel so the board is as big as possible.
 */
export function GameStage({
  title,
  subtitle,
  color,
  board,
  dock,
  side,
  sideLabel = 'Players & chat',
}: {
  title: string;
  subtitle?: string;
  color: string;
  board: ReactNode;
  dock?: ReactNode;
  side: ReactNode;
  sideLabel?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [note, setNote] = useState<string | null>(null);
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
    const onChange = () => setFull(!!fsElement());
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 6000);
    return () => clearTimeout(t);
  }, [note]);

  const toggleFull = async () => {
    try {
      if (fsElement()) {
        await (document.exitFullscreen?.() ?? (document as FsDoc).webkitExitFullscreen?.());
        setFocusMode(false);
        return;
      }
      const el = document.documentElement as FsEl;
      const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
      if (!request) throw new Error('unsupported');
      await request();
      setFocusMode(true);
    } catch {
      setFocusMode((v) => {
        if (!v) setNote('Your browser would not allow full screen here. Press F11, or open the game in Chrome/Edge. Side panel hidden for a bigger board.');
        return !v;
      });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') void toggleFull();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const showSide = wide && !focusMode;
  const iconBtn = 'btn btn-paper btn-small !px-2.5';

  return (
    <div ref={root} className="table-bg fixed inset-0 z-30 flex">
      <div className="relative min-w-0 flex-1 p-2 sm:p-3">
        <div className="relative h-full w-full overflow-hidden rounded-[22px] border-4 border-[var(--ink)] bg-[#150e0a] shadow-[0_6px_0_var(--ink)]">
          {board}

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2.5 sm:p-3">
            <div className="panel pointer-events-auto flex min-w-0 items-center gap-2.5 !rounded-2xl px-3 py-1.5 !shadow-[0_4px_0_var(--ink)]">
              <span className="h-5 w-5 shrink-0 rounded-full border-[3px] border-[var(--ink)]" style={{ backgroundColor: color }} />
              <div className="min-w-0">
                <p className="font-title truncate text-lg leading-tight">{title}</p>
                {subtitle && <p className="truncate text-xs font-bold text-[var(--ink-soft)]">{subtitle}</p>}
              </div>
            </div>

            <div className="pointer-events-auto flex shrink-0 items-center gap-2">
              <span
                title={connected ? 'Connected' : 'Offline'}
                className={`h-3.5 w-3.5 rounded-full border-2 border-[var(--ink)] ${connected ? 'bg-[var(--green)]' : 'bg-[var(--red)]'}`}
              />
              <button type="button" className={iconBtn} title={muted ? 'Sound off' : 'Sound on'} onClick={() => { setMuted(!muted); if (muted) play('click'); }}>
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button type="button" className={iconBtn} title={full || focusMode ? 'Exit full screen (F)' : 'Full screen (F)'} onClick={() => void toggleFull()}>
                {full || focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              {wide && focusMode && (
                <button type="button" className={iconBtn} title="Show side panel" onClick={() => setFocusMode(false)}>
                  <PanelRightOpen size={18} />
                </button>
              )}
              {wide && !focusMode && (
                <button type="button" className={iconBtn} title="Hide side panel" onClick={() => setFocusMode(true)}>
                  <PanelRightClose size={18} />
                </button>
              )}
              {!wide && (
                <button type="button" className={iconBtn} title={sideLabel} onClick={() => setDrawer(true)}>
                  <Menu size={18} />
                </button>
              )}
            </div>
          </div>

          {note && (
            <p role="status" className="panel absolute left-1/2 top-16 z-20 w-[min(92%,520px)] -translate-x-1/2 px-4 py-2 text-center text-sm font-bold">
              {note}
            </p>
          )}

          {dock && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
              <div className="pointer-events-auto w-full max-w-[400px]">{dock}</div>
            </div>
          )}
        </div>
      </div>

      {showSide && (
        <aside className="w-[350px] shrink-0 space-y-3 overflow-y-auto py-3 pr-3">{side}</aside>
      )}

      {!wide && drawer && (
        <div className="table-bg absolute inset-0 z-20 flex flex-col">
          <div className="flex items-center justify-between p-3">
            <p className="font-title text-xl text-[var(--cream)]">{sideLabel}</p>
            <button type="button" className={iconBtn} onClick={() => setDrawer(false)} aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3 pt-0">{side}</div>
        </div>
      )}
    </div>
  );
}
