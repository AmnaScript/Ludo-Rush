import { useState } from 'react';
import { Bot, WifiOff } from 'lucide-react';
import { ROOM_LIMITS } from '@ludo-rush/shared';
import { ChatPanel } from '../components/ChatPanel';
import { DifficultyPicker } from '../components/DifficultyPicker';
import { leaveRoom } from '../net/session';
import { socket } from '../net/socket';
import { useRoomStore } from '../store/roomStore';

const SEAT_COLORS = ['#d93a2f', '#2f6bd8', '#f2b81c', '#2a9d57'];

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
    <div className="table-bg fixed inset-0 z-30 overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="panel p-5">
            <p className="label">Room code — tell your friends</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className="font-title text-5xl tracking-[0.18em]">{snapshot.code}</span>
              <button onClick={copy} className="btn btn-blue btn-small">{copied ? 'Copied!' : 'Copy invite link'}</button>
            </div>
          </section>

          <section className="panel p-5">
            <p className="panel-title">Players in the room ({count}/{ROOM_LIMITS.maxPlayers})</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {snapshot.players.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 rounded-xl border-[3px] border-[var(--ink)] bg-[#fffaf0] px-3 py-2 font-extrabold">
                  <span className="h-5 w-5 shrink-0 rounded-full border-[3px] border-[var(--ink)]" style={{ backgroundColor: SEAT_COLORS[i % 4] }} />
                  <span className="truncate">
                    {p.nickname}
                    {p.id === session.playerId && <span className="text-[var(--ink-soft)]"> (you)</span>}
                  </span>
                  {p.isHost && <span className="ml-auto rounded-md bg-[var(--brass)] px-1.5 text-xs">HOST</span>}
                  {p.isBot && <Bot size={14} className="shrink-0" aria-label="Bot" />}
                  {!p.connected && <WifiOff size={14} className="shrink-0 text-[var(--red)]" aria-label="Offline" />}
                </li>
              ))}
            </ul>
            {snapshot.spectators > 0 && <p className="mt-3 text-xs font-bold text-[var(--ink-soft)]">{snapshot.spectators} watching</p>}
          </section>

          <section className="panel space-y-4 p-5">
            <p className="panel-title">Game settings {!isHost && <span className="text-sm text-[var(--ink-soft)]">(host chooses)</span>}</p>

            <DifficultyPicker
              value={snapshot.options.difficulty}
              disabled={!isHost}
              onChange={(d) => socket.emit('room:options', { difficulty: d })}
            />

            <div>
              <p className="label">Characters each</p>
              <div className="mt-1 flex gap-2">
                {([1, 2, 4] as const).map((n) => (
                  <button
                    key={n}
                    disabled={!isHost}
                    aria-pressed={snapshot.options.piecesPerPlayer === n}
                    onClick={() => socket.emit('room:options', { piecesPerPlayer: n })}
                    className="chip flex-1 text-xl"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="label">Seconds per turn</p>
              <div className="mt-1 flex gap-2">
                {[10, 20, 30, 45].map((n) => (
                  <button
                    key={n}
                    disabled={!isHost}
                    aria-pressed={snapshot.options.turnSeconds === n}
                    onClick={() => socket.emit('room:options', { turnSeconds: n })}
                    className="chip flex-1"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border-[3px] border-[var(--ink)] bg-[var(--red)] p-3 text-sm font-extrabold text-white">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              {isHost && (
                <button disabled={!canStart} onClick={() => socket.emit('game:start')} className="btn btn-red !px-6 !py-3 text-xl">
                  {canStart ? `Start game (${count} players)` : 'Waiting for one more player…'}
                </button>
              )}
              {!isHost && <p className="font-extrabold text-[var(--ink-soft)]">Waiting for the host to start…</p>}
              <button onClick={leaveRoom} className="btn btn-paper btn-small">Leave room</button>
            </div>
          </section>
        </div>

        <ChatPanel playerCount={Math.max(count, 2)} className="h-[28rem] lg:h-auto" />
      </div>
    </div>
  );
}
