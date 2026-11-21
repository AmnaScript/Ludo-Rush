import { CLASSIC_COLORS } from '../game/boardLayout';
import { useState } from 'react';
import { ROOM_LIMITS } from '@ludo-rush/shared';
import { Mascot } from '../components/Mascots';
import { ChatPanel } from '../components/ChatPanel';
import { DifficultyPicker } from '../components/DifficultyPicker';
import { leaveRoom } from '../net/session';
import { socket } from '../net/socket';
import { useRoomStore } from '../store/roomStore';

const SEAT_COLORS = CLASSIC_COLORS;
const SEAT_NAMES = ['Red', 'Blue', 'Yellow', 'Green'];

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
            <div className="flex items-center justify-between">
              <p className="panel-title">Players</p>
              <span className="badge badge-amber">{count}/{ROOM_LIMITS.maxPlayers} ready to play</span>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: ROOM_LIMITS.maxPlayers }, (_, i) => {
                const p = snapshot.players[i];
                const color = SEAT_COLORS[i % 4]!;
                if (!p) {
                  return (
                    <li key={`empty-${i}`} className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 px-3 py-5 text-center">
                      <span className="label" style={{ color }}>{SEAT_NAMES[i]}</span>
                      <span className="mt-3 font-title text-lg">Open seat</span>
                      <span className="text-xs font-bold text-[var(--ink-soft)]">Share the code to invite</span>
                    </li>
                  );
                }
                return (
                  <li key={p.id} className="flex flex-col items-center rounded-2xl bg-[var(--paper-2)] px-3 py-3 text-center" style={{ boxShadow: `inset 0 3px 0 ${color}` }}>
                    <span className="flex w-full items-center justify-between">
                      <span className="label" style={{ color }}>{SEAT_NAMES[i]}</span>
                      {p.isHost ? <span className="badge badge-amber">Host</span> : p.isBot ? <span className="badge">Bot</span> : p.connected ? <span className="badge badge-green">Online</span> : <span className="badge badge-red">Offline</span>}
                    </span>
                    <Mascot color={color} i={i} className="mt-2 h-20 w-14" />
                    <span className="mt-1 w-full truncate font-title text-lg">{p.nickname}</span>
                    {p.id === session.playerId && <span className="text-xs font-bold text-[var(--ink-soft)]">you</span>}
                  </li>
                );
              })}
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
