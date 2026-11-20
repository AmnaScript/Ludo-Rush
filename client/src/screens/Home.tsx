import { useState } from 'react';
import { ROOM_LIMITS, type Difficulty } from '@ludo-rush/shared';
import { DifficultyPicker } from '../components/DifficultyPicker';
import { DiceIcon, Mascot } from '../components/Mascots';
import { createRoom, joinRoom, savedNickname } from '../net/session';
import { useConnectionStore } from '../store/connectionStore';
import { useRoomStore } from '../store/roomStore';

type Step = 'menu' | 'create' | 'join';
const COLORS = ['#d93a2f', '#2f6bd8', '#f2b81c', '#2a9d57'];

export function Home({ onLocal }: { onLocal: () => void }) {
  const connected = useConnectionStore((s) => s.connected);
  const { busy, error, setError } = useRoomStore();
  const [nickname, setNickname] = useState(savedNickname());
  const urlCode = (new URLSearchParams(window.location.search).get('room') ?? '').toUpperCase().slice(0, ROOM_LIMITS.codeLength);
  const [code, setCode] = useState(urlCode);
  const [step, setStep] = useState<Step>(urlCode ? 'join' : 'menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [pieces, setPieces] = useState<1 | 2 | 4>(4);

  const name = nickname.trim();
  const ready = connected && !busy && name.length > 0;

  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };

  const nicknameField = (
    <div>
      <label className="label" htmlFor="nick">Your name</label>
      <input
        id="nick"
        value={nickname}
        maxLength={ROOM_LIMITS.maxNickname}
        onChange={(e) => {
          setNickname(e.target.value);
          setError(null);
        }}
        placeholder="e.g. Amna"
        className="field mt-1 text-lg"
        autoFocus
      />
    </div>
  );

  return (
    <div className="table-bg fixed inset-0 z-30 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-xl flex-col items-center px-4 py-8 sm:py-12">
        {/* title lockup */}
        <div className="text-center">
          <h1 className="font-title text-[64px] leading-[0.9] sm:text-[88px]" style={{ WebkitTextStroke: '3px var(--ink)', paintOrder: 'stroke fill', textShadow: '0 6px 0 var(--ink)' }}>
            <span style={{ color: 'var(--red)' }}>LUDO</span>
            <br />
            <span style={{ color: 'var(--yellow)' }}>RUSH</span>
          </h1>
          <p className="mt-4 font-extrabold text-[var(--paper)]">Shoot. Slap. Sic the dog. Get home first.</p>
        </div>

        <div className="mt-6 flex items-end justify-center gap-1 sm:gap-3">
          {COLORS.map((c, i) => (
            <Mascot key={c} color={c} i={i} className="bob h-24 w-[70px] sm:h-28 sm:w-20" />
          ))}
        </div>

        <div className="panel mt-6 w-full space-y-4 p-5">
          {step === 'menu' && (
            <>
              <button className="btn btn-red w-full !py-4 text-2xl" onClick={() => go('create')}>Create a room</button>
              <button className="btn btn-blue w-full !py-4 text-2xl" onClick={() => go('join')}>Join with a code</button>
              <button className="btn btn-paper w-full !py-3 text-lg" onClick={onLocal}>
                Play on this device
              </button>
              {!connected && (
                <p className="text-center text-sm font-bold text-[var(--ink-soft)]">
                  Connecting to the game server… online rooms unlock as soon as it connects.
                </p>
              )}
            </>
          )}

          {step === 'create' && (
            <>
              <p className="panel-title">Create a room</p>
              {nicknameField}
              <div>
                <p className="label">Difficulty</p>
                <div className="mt-1"><DifficultyPicker value={difficulty} onChange={setDifficulty} /></div>
              </div>
              <div>
                <p className="label">Characters each</p>
                <div className="mt-1 flex gap-2">
                  {([1, 2, 4] as const).map((n) => (
                    <button key={n} aria-pressed={pieces === n} onClick={() => setPieces(n)} className="chip flex-1 text-xl">{n}</button>
                  ))}
                </div>
              </div>
              <button disabled={!ready} onClick={() => createRoom(name, pieces, difficulty)} className="btn btn-red w-full !py-3 text-xl">
                Create room
              </button>
            </>
          )}

          {step === 'join' && (
            <>
              <p className="panel-title">Join a room</p>
              {nicknameField}
              <div>
                <label className="label" htmlFor="code">Room code</label>
                <input
                  id="code"
                  value={code}
                  maxLength={ROOM_LIMITS.codeLength}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="K7P2QX"
                  className="field mt-1 text-center font-mono text-2xl tracking-[0.3em]"
                />
              </div>
              <button disabled={!ready || code.length !== ROOM_LIMITS.codeLength} onClick={() => joinRoom(code, name)} className="btn btn-blue w-full !py-3 text-xl">
                Join room
              </button>
            </>
          )}

          {step !== 'menu' && (
            <button className="block w-full text-center text-sm font-extrabold text-[var(--ink-soft)] underline" onClick={() => go('menu')}>
              ← Back
            </button>
          )}

          {error && (
            <p role="alert" className="rounded-xl border-[3px] border-[var(--ink)] bg-[var(--red)] p-3 text-sm font-extrabold text-white">
              {error}
            </p>
          )}
          {step !== 'menu' && !connected && (
            <p className="text-center text-sm font-bold text-[var(--ink-soft)]">Not connected to the game server yet.</p>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2 text-sm font-bold text-[var(--paper)] opacity-80">
          <DiceIcon className="h-6 w-6" /> 2 to 4 players per room
        </div>
      </div>
    </div>
  );
}
