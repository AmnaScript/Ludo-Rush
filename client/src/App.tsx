import { useEffect, useState } from 'react';
import { startSession } from './net/session';
import { useRoomStore } from './store/roomStore';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { LocalGame } from './screens/LocalGame';
import { OnlineGame } from './screens/OnlineGame';

export default function App() {
  const snapshot = useRoomStore((s) => s.snapshot);
  const session = useRoomStore((s) => s.session);
  const [local, setLocal] = useState(false);

  useEffect(() => {
    startSession();
  }, []);

  const inRoom = !!snapshot && !!session;
  const playing = inRoom && snapshot.phase !== 'LOBBY' && !!snapshot.game;

  if (inRoom) return playing ? <OnlineGame /> : <Lobby />;
  if (local) return <LocalGame onExit={() => setLocal(false)} />;
  return <Home onLocal={() => setLocal(true)} />;
}
