
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Dice5,
  Focus,
  Minus,
  Plus,
  Radio,
  RotateCcw,
  Wifi,
  WifiOff,
} from 'lucide-react';

import {
  createBoardGeometry,
  seatColor,
} from '@ludo-rush/shared';

import {
  PhaserGame,
  type PhaserGameHandle,
} from './game/PhaserGame';

import { socket } from './net/socket';

import {
  useConnectionStore,
} from './store/connectionStore';

export default function App() {
  const {
    connected,
    status,
    setConnected,
    setStatus,
  } = useConnectionStore();

  const [playerCount, setPlayerCount] =
    useState(4);

  const [pingPending, setPingPending] =
    useState(false);

  const boardRef =
    useRef<PhaserGameHandle>(null);

  const geometry =
    createBoardGeometry(playerCount);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setStatus('Socket connected');
    };

    const onDisconnect = () => {
      setConnected(false);
      setStatus(
        'Server disconnected — reconnecting…'
      );
    };

    const onError = () => {
      setConnected(false);
      setStatus(
        'Cannot reach server. Is port 5000 running?'
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);

    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.disconnect();
    };
  }, [setConnected, setStatus]);

  const ping = () => {
    if (!socket.connected) return;

    setPingPending(true);
    setStatus('Sending app:ping…');

    socket.timeout(3000).emit(
      'app:ping',
      (error, response) => {
        setPingPending(false);

        setStatus(
          error
            ? 'Ping timed out — check the server'
            : `PONG received at ${new Date(
              response.at
            ).toLocaleTimeString()}`
        );
      }
    );
  };

  return (
    <main className="min-h-screen bg-[#101222] px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-400 p-2 text-slate-950">
              <Dice5 size={25} />
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight">
                Ludo{' '}
                <span className="text-amber-400">
                  Rush
                </span>
              </h1>

              <p className="text-xs text-slate-400">
                Phase 2 · Dynamic board preview
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${connected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              }`}
          >
            {connected ? (
              <Wifi size={14} />
            ) : (
              <WifiOff size={14} />
            )}

            {connected ? 'Online' : 'Offline'}
          </span>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 rounded-3xl border border-white/10 bg-[#1a1c31] p-3 shadow-2xl sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">
                  Board preview
                </h2>

                <p className="text-xs text-slate-400">
                  Drag to pan · scroll or pinch to zoom
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  aria-label="Zoom out"
                  title="Zoom out"
                  className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
                  onClick={() =>
                    boardRef.current?.zoomOut()
                  }
                >
                  <Minus size={17} />
                </button>

                <button
                  aria-label="Zoom in"
                  title="Zoom in"
                  className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
                  onClick={() =>
                    boardRef.current?.zoomIn()
                  }
                >
                  <Plus size={17} />
                </button>

                <button
                  aria-label="Fit board"
                  title="Fit board"
                  className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
                  onClick={() =>
                    boardRef.current?.resetView()
                  }
                >
                  <Focus size={17} />
                </button>
              </div>
            </div>

            <PhaserGame
              ref={boardRef}
              playerCount={playerCount}
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>
                {geometry.L} ring tiles ·{' '}
                {geometry.H} home-lane cells per player
              </span>

              <span>
                Stars and house tiles are safe
              </span>
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-white/10 bg-[#1a1c31] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-bold">
                  Board settings
                </h2>

                <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs text-amber-300">
                  DEV ONLY
                </span>
              </div>

              <label
                htmlFor="player-count"
                className="flex items-center justify-between text-sm text-slate-300"
              >
                <span>Players</span>

                <strong className="text-xl text-white">
                  {playerCount}
                </strong>
              </label>

              <input
                id="player-count"
                type="range"
                min="2"
                max="20"
                step="1"
                value={playerCount}
                onChange={event =>
                  setPlayerCount(
                    Number(event.target.value)
                  )
                }
                className="mt-3 w-full accent-amber-400"
              />

              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>2</span>
                <span>20</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-xl bg-white/5 p-3">
                  <strong className="block text-lg">
                    {geometry.S}
                  </strong>

                  <span className="text-xs text-slate-400">
                    Tiles/segment
                  </span>
                </div>

                <div className="rounded-xl bg-white/5 p-3">
                  <strong className="block text-lg">
                    {geometry.L}
                  </strong>

                  <span className="text-xs text-slate-400">
                    Total ring tiles
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setPlayerCount(4);
                  boardRef.current?.resetView();
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/10"
              >
                <RotateCcw size={16} />
                Reset to 4 players
              </button>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#1a1c31] p-5">
              <h2 className="mb-3 font-bold">
                Player legend
              </h2>

              <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto text-xs">
                {Array.from(
                  { length: playerCount },
                  (_, seat) => (
                    <div
                      key={seat}
                      className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-2"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor: seatColor(
                            seat,
                            playerCount
                          ),
                        }}
                      />

                      <span>
                        Player {seat + 1}
                      </span>
                    </div>
                  )
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#1a1c31] p-5">
              <div className="mb-3 flex items-center gap-2 text-amber-300">
                <Radio size={19} />

                <h2 className="font-bold">
                  Socket smoke test
                </h2>
              </div>

              <p
                className="mb-3 text-sm text-slate-300"
                role="status"
              >
                {status}
              </p>

              <button
                disabled={
                  !connected || pingPending
                }
                onClick={ping}
                className="w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pingPending
                  ? 'Pinging…'
                  : 'Send socket ping'}
              </button>
            </section>
          </aside>
        </div>

        <footer className="mt-7 text-center text-xs text-slate-500">
          Visual board only. Dice, characters and turns
          arrive in later phases.
        </footer>
      </div>
    </main>
  );
}
