import { useEffect, useState } from 'react';
import { Dice5, Wifi, WifiOff } from 'lucide-react';
import { startSession } from './net/session';
import { useConnectionStore } from './store/connectionStore';
import { useRoomStore } from './store/roomStore';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { LocalGame } from './screens/LocalGame';
import { OnlineGame } from './screens/OnlineGame';

export default function App() {
  const connected = useConnectionStore((s) => s.connected);
  const status = useConnectionStore((s) => s.status);
  const snapshot = useRoomStore((s) => s.snapshot);
  const session = useRoomStore((s) => s.session);
  const [local, setLocal] = useState(false);

  useEffect(() => {
    startSession();
  }, []);

  const inRoom = !!snapshot && !!session;
  const playing = inRoom && snapshot.phase !== 'LOBBY' && !!snapshot.game;

  return (
    <main className="min-h-screen bg-[#fff3db] px-3 py-5 text-[#223748] sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#ffb82e] p-3 text-[#213747] shadow">
              <Dice5 size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black">
                Ludo <span className="text-[#f53d62]">Rush</span>
              </h1>
              <p className="text-xs text-[#69808d]">Multiplayer 3D Ludo · any number of players</p>
            </div>
          </div>

          <span
            title={status}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ${connected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
          >
            {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
            {connected ? 'Online' : status}
          </span>
        </header>

        {inRoom ? (
          playing ? <OnlineGame /> : <Lobby />
        ) : local ? (
          <LocalGame onExit={() => setLocal(false)} />
        ) : (
          <Home onLocal={() => setLocal(true)} />
        )}
      </div>
    </main>
  );
}
