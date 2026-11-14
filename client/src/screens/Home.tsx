import { useState } from 'react';
import { Gamepad2, LogIn, MonitorSmartphone, Users } from 'lucide-react';
import { ROOM_LIMITS } from '@ludo-rush/shared';
import { createRoom, joinRoom, savedNickname } from '../net/session';
import { useConnectionStore } from '../store/connectionStore';
import { useRoomStore } from '../store/roomStore';

export function Home({ onLocal }: { onLocal: () => void }) {
  const connected = useConnectionStore((s) => s.connected);
  const { busy, error, setError } = useRoomStore();
  const [nickname, setNickname] = useState(savedNickname());
  const [code, setCode] = useState(() =>
    (new URLSearchParams(window.location.search).get('room') ?? '').toUpperCase().slice(0, ROOM_LIMITS.codeLength),
  );
  const [pieces, setPieces] = useState<1 | 2 | 4>(1);

  const name = nickname.trim();
  const ready = connected && !busy && name.length > 0;

  return (
    <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
      <section className="rounded-3xl bg-white p-6 shadow-sm sm:col-span-2">
        <h2 className="text-2xl font-black">Play with friends</h2>
        <p className="mt-1 text-sm text-slate-500">
          Make a room, share the code, and everyone who joins gets a seat. 2, 9 or 16 players: it all fits.
        </p>

        <label className="mt-4 block text-sm font-bold" htmlFor="nick">
          Your nickname
        </label>
        <input
          id="nick"
          value={nickname}
          maxLength={ROOM_LIMITS.maxNickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Amna"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-amber-400"
        />

        {!connected && (
          <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
            Not connected to the game server yet. Online rooms start working as soon as it connects.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">
            {error}
          </p>
        )}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 font-black">
          <Users size={18} /> Create a room
        </h3>

        <p className="mt-3 text-sm font-semibold">Characters per player</p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {([1, 2, 4] as const).map((n) => (
            <button
              key={n}
              onClick={() => setPieces(n)}
              className={`rounded-xl border p-2 text-sm font-bold ${pieces === n ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">1 is a quick game (best for big rooms). 4 is classic.</p>

        <button
          disabled={!ready}
          onClick={() => createRoom(name, pieces)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ffbd43] p-4 font-black text-[#263640] hover:bg-[#ffd06d] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Gamepad2 size={18} /> Create room
        </button>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 font-black">
          <LogIn size={18} /> Join a room
        </h3>

        <label className="mt-3 block text-sm font-semibold" htmlFor="code">
          Room code
        </label>
        <input
          id="code"
          value={code}
          maxLength={ROOM_LIMITS.codeLength}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="K7P2QX"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-mono text-lg tracking-widest outline-none focus:border-amber-400"
        />

        <button
          disabled={!ready || code.length !== ROOM_LIMITS.codeLength}
          onClick={() => joinRoom(code, name)}
          className="mt-4 w-full rounded-2xl border-2 border-[#ffbd43] p-4 font-black text-[#263640] hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Join room
        </button>
      </section>

      <button
        onClick={onLocal}
        className="flex items-center justify-center gap-2 rounded-2xl p-3 text-sm font-semibold text-slate-600 hover:bg-white/60 sm:col-span-2"
      >
        <MonitorSmartphone size={16} /> Play on this device only (pass and play)
      </button>
    </div>
  );
}
