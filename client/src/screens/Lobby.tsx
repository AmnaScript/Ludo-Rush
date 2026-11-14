import { useState } from 'react';
import { Bot, Check, Copy, Crown, LogOut, Play, WifiOff } from 'lucide-react';
import { ROOM_LIMITS } from '@ludo-rush/shared';
import { ChatPanel } from '../components/ChatPanel';
import { leaveRoom } from '../net/session';
import { socket } from '../net/socket';
import { useRoomStore } from '../store/roomStore';

export function Lobby() {
  const snapshot = useRoomStore((s) => s.snapshot)!;
  const session = useRoomStore((s) => s.session)!;
  const error = useRoomStore((s) => s.error);
  const [copied, setCopied] = useState(false);

  const isHost = snapshot.hostId === session.playerId;
  const count = snapshot.players.length;
  const canStart = isHost && count >= ROOM_LIMITS.minPlayersToStart;
  const link = `${window.location.origin}/?room=${snapshot.code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link:', link);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Room code</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <span className="font-mono text-4xl font-black tracking-[0.25em]">{snapshot.code}</span>
            <button
              onClick={copy}
              className="flex items-center gap-2 rounded-xl bg-[#edf4f3] px-3 py-2 text-sm font-bold"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Link copied' : 'Copy invite link'}
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Friends open the link (or type the code). Everyone in the room gets a seat when the host starts.
          </p>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="font-black">
            Players <span className="text-slate-400">({count})</span>
          </h2>

          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {snapshot.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="truncate font-semibold">
                  {p.nickname}
                  {p.id === session.playerId && <span className="text-slate-400"> (you)</span>}
                </span>
                {p.isHost && <Crown size={14} className="shrink-0 text-amber-500" aria-label="Host" />}
                {p.isBot && <Bot size={14} className="shrink-0 text-slate-400" aria-label="Bot" />}
                {!p.connected && <WifiOff size={14} className="shrink-0 text-rose-500" aria-label="Offline" />}
              </li>
            ))}
          </ul>

          {snapshot.spectators > 0 && (
            <p className="mt-3 text-xs text-slate-500">{snapshot.spectators} watching</p>
          )}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="font-black">Game settings</h2>

          <p className="mt-3 text-sm font-semibold">Characters per player</p>
          <div className="mt-1 grid max-w-xs grid-cols-3 gap-2">
            {([1, 2, 4] as const).map((n) => (
              <button
                key={n}
                disabled={!isHost}
                onClick={() => socket.emit('room:options', { piecesPerPlayer: n })}
                className={`rounded-xl border p-2 text-sm font-bold disabled:cursor-not-allowed ${snapshot.options.piecesPerPlayer === n ? 'border-amber-400 bg-amber-50' : 'border-slate-200'
                  }`}
              >
                {n}
              </button>
            ))}
          </div>

          <p className="mt-4 text-sm font-semibold">Seconds per turn</p>
          <div className="mt-1 grid max-w-xs grid-cols-4 gap-2">
            {[10, 20, 30, 45].map((n) => (
              <button
                key={n}
                disabled={!isHost}
                onClick={() => socket.emit('room:options', { turnSeconds: n })}
                className={`rounded-xl border p-2 text-sm font-bold disabled:cursor-not-allowed ${snapshot.options.turnSeconds === n ? 'border-amber-400 bg-amber-50' : 'border-slate-200'
                  }`}
              >
                {n}
              </button>
            ))}
          </div>

          {!isHost && <p className="mt-3 text-xs text-slate-500">Only the host can change settings.</p>}
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {isHost && (
              <button
                disabled={!canStart}
                onClick={() => socket.emit('game:start')}
                className="flex items-center gap-2 rounded-2xl bg-[#ffbd43] px-6 py-4 font-black text-[#263640] hover:bg-[#ffd06d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play size={18} />
                {canStart ? `Start game with ${count}` : 'Waiting for one more player…'}
              </button>
            )}
            <button
              onClick={leaveRoom}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-4 font-semibold"
            >
              <LogOut size={16} /> Leave room
            </button>
          </div>
        </section>
      </div>

      <ChatPanel playerCount={Math.max(count, 2)} className="h-[28rem] lg:h-auto" />
    </div>
  );
}
