import { useEffect, useState } from 'react';
import { CheckCircle2, CircleHelp, Dice5, Radio, Wifi, WifiOff } from 'lucide-react';
import { PhaserGame } from './game/PhaserGame';
import { socket } from './net/socket';
import { useConnectionStore } from './store/connectionStore';

export default function App() {
  const { connected, status, setConnected, setStatus } = useConnectionStore();
  const [pingPending, setPingPending] = useState(false);

  useEffect(() => {
    const onConnect = () => { setConnected(true); setStatus('Socket connected'); };
    const onDisconnect = () => { setConnected(false); setStatus('Server disconnected — reconnecting…'); };
    const onError = () => { setConnected(false); setStatus('Cannot reach server. Is port 5000 running?'); };
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
    socket.timeout(3000).emit('app:ping', (error, response) => {
      setPingPending(false);
      setStatus(error ? 'Ping timed out — check the server' : `PONG received at ${new Date(response.at).toLocaleTimeString()}`);
    });
  };

  return (
    <main className="min-h-screen bg-[#101222] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-amber-400 p-2 text-slate-950"><Dice5 size={25} /></div><div><h1 className="text-2xl font-black tracking-tight">Ludo <span className="text-amber-400">Rush</span></h1><p className="text-xs text-slate-400">Build 0.1 · Project foundation</p></div></div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>{connected ? <Wifi size={14} /> : <WifiOff size={14} />}{connected ? 'Online' : 'Offline'}</span>
        </header>
        <div className="grid gap-6 lg:grid-cols-[1fr_310px]">
          <section className="rounded-3xl border border-white/10 bg-[#1a1c31] p-4 shadow-2xl sm:p-6">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Phaser canvas</h2><span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">Scene loaded</span></div>
            <PhaserGame />
            <p className="mt-4 text-center text-sm text-slate-400">The generated multiplayer board arrives in Phase 2.</p>
          </section>
          <aside className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-[#1a1c31] p-6"><div className="mb-4 flex items-center gap-2 text-amber-300"><Radio size={19}/><h2 className="font-bold">Live connection test</h2></div><p className="mb-5 min-h-12 text-sm leading-relaxed text-slate-300" role="status">{status}</p><button disabled={!connected || pingPending} onClick={ping} className="w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40">{pingPending ? 'Pinging…' : 'Send socket ping'}</button><p className="mt-3 text-xs text-slate-500">Expected response: PONG from Express + Socket.IO.</p></div>
            <div className="rounded-3xl border border-white/10 bg-[#1a1c31] p-6"><h2 className="mb-4 font-bold">Phase 0 checklist</h2><div className="space-y-3 text-sm"><div className="flex gap-2 text-emerald-300"><CheckCircle2 size={18} /> React, Tailwind & Zustand</div><div className="flex gap-2 text-emerald-300"><CheckCircle2 size={18} /> Phaser scene mounted</div><div className="flex gap-2 text-emerald-300"><CheckCircle2 size={18} /> Shared TypeScript contracts</div><div className="flex gap-2 text-slate-300"><CircleHelp size={18} /> Confirm socket ping above</div></div></div>
          </aside>
        </div><footer className="mt-8 text-center text-xs text-slate-500">Guest rooms, dice and game rules will be implemented in later phases.</footer>
      </div>
    </main>
  );
}
