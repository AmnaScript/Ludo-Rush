import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, LogOut, Trophy, WifiOff } from 'lucide-react';
import type { GameState, TurnInfo } from '@ludo-rush/shared';
import { Board3D, type Board3DHandle } from '../game/Board3D';
import { playerColor } from '../game/boardLayout';
import { GameStage } from '../components/GameStage';
import { RulesCard } from '../components/RulesCard';
import { ChatPanel } from '../components/ChatPanel';
import { play } from '../audio/sfx';
import { ROLL_MS, RollingDice } from '../components/RollingDice';
import { leaveRoom } from '../net/session';
import { socket } from '../net/socket';
import { useRoomStore } from '../store/roomStore';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function OnlineGame() {
  const snapshot = useRoomStore((s) => s.snapshot)!;
  const session = useRoomStore((s) => s.session)!;
  const error = useRoomStore((s) => s.error);

  const me = snapshot.players.find((p) => p.id === session.playerId);
  const mySeat = me?.seat ?? null;
  const spectator = mySeat === null;
  const isHost = snapshot.hostId === session.playerId;
  const N = snapshot.game!.N;

  const boardRef = useRef<Board3DHandle>(null);
  const mySeatRef = useRef(mySeat);
  const rollClickedAt = useRef(0);
  mySeatRef.current = mySeat;

  const [game, setGame] = useState<GameState>(snapshot.game!);
  const [turn, setTurn] = useState<TurnInfo | null>(snapshot.turn);
  const [dice, setDice] = useState<number | null>(snapshot.turn?.dice ?? null);
  const [validIds, setValidIds] = useState<string[]>(
    snapshot.turn && snapshot.turn.seat === mySeat ? snapshot.turn.validPieceIds : [],
  );
  const [animating, setAnimating] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [follow, setFollow] = useState(spectator);
  const [view, setView] = useState(mySeat ?? 0);
  const [now, setNow] = useState(Date.now());

  // All game events go through one queue so scenes never overlap and order is kept.
  const queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    const enqueue = (job: () => Promise<void> | void) => {
      queue.current = queue.current.then(job).catch(console.error);
    };

    const onRolled: Parameters<typeof socket.on<'game:rolled'>>[1] = (p) =>
      enqueue(async () => {
        // The dice tumbles first (also for other players' rolls), then lands.
        setRolling(true);
        setTurn(null);
        setValidIds([]);
        const spent = Date.now() - rollClickedAt.current;
        await sleep(Math.max(450, ROLL_MS - spent));
        setRolling(false);
        setDice(p.value);
        await sleep(650);
        setGame(p.game);
        setValidIds(p.seat === mySeatRef.current ? p.validPieceIds : []);
      });

    const onTurn: Parameters<typeof socket.on<'game:turn'>>[1] = (t) =>
      enqueue(() => {
        setTurn(t);
        setRolling(false);
        if (t.dice === null && t.seat === mySeatRef.current) play('turn');
        if (t.dice === null) setValidIds([]);
        else if (t.seat === mySeatRef.current) setValidIds(t.validPieceIds);
      });

    const onMoved: Parameters<typeof socket.on<'game:moved'>>[1] = (p) =>
      enqueue(async () => {
        setTurn(null);
        setValidIds([]);
        setAnimating(true);
        try {
          // Never let a hidden tab (paused animation loop) freeze the queue forever.
          await Promise.race([boardRef.current?.playMove(p.move), sleep(p.lockMs + 4000)]);
        } finally {
          setAnimating(false);
        }
        setGame(p.move.game);
        setDice(null);
      });

    const onState: Parameters<typeof socket.on<'room:state'>>[1] = (s) =>
      enqueue(() => {
        if (s.game) setGame(s.game);
        setTurn(s.turn);
        if (s.turn) {
          setDice(s.turn.dice);
          setValidIds(s.turn.seat === mySeatRef.current ? s.turn.validPieceIds : []);
        }
      });

    socket.on('game:rolled', onRolled);
    socket.on('game:turn', onTurn);
    socket.on('game:moved', onMoved);
    socket.on('room:state', onState);
    return () => {
      socket.off('game:rolled', onRolled);
      socket.off('game:turn', onTurn);
      socket.off('game:moved', onMoved);
      socket.off('room:state', onState);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const players = useMemo(
    () => [...snapshot.players].filter((p) => p.seat !== null).sort((a, b) => a.seat! - b.seat!),
    [snapshot.players],
  );
  const seatLabels = useMemo(
    () => Object.fromEntries(players.map((p) => [p.seat!, p.nickname.slice(0, 12)])),
    [players],
  );
  const nameOfSeat = (seat: number) => players.find((p) => p.seat === seat)?.nickname ?? `Player ${seat + 1}`;

  const finished = snapshot.phase === 'FINISHED';
  useEffect(() => {
    if (finished) play('win');
  }, [finished]);
  const activeSeat = game.turnSeat;
  const myTurn = mySeat !== null && activeSeat === mySeat;
  const canRoll = myTurn && !!turn && turn.dice === null && !animating && !rolling && !finished;
  const mustChoose = myTurn && validIds.length > 1 && !animating;
  const viewSeat = follow || finished ? activeSeat : view;
  const secondsLeft = turn?.deadline ? Math.max(0, Math.ceil((turn.deadline - now) / 1000)) : null;

  const roll = () => {
    if (!canRoll) return;
    rollClickedAt.current = Date.now();
    setRolling(true);
    socket.emit('game:roll');
  };

  const choose = (id: string) => {
    if (!mustChoose || !validIds.includes(id)) return;
    setValidIds([]);
    socket.emit('game:move', { pieceId: id });
  };

  const homeCount = (seat: number) =>
    game.pieces.filter((p) => p.ownerSeat === seat && p.progress === game.L + game.H).length;
  const perPlayer = game.pieces.length / Math.max(1, players.length);

  const status = finished
    ? 'Game complete'
    : spectator
      ? `Watching: ${nameOfSeat(activeSeat)}'s turn`
      : myTurn
        ? animating
          ? 'Watch your move…'
          : mustChoose
            ? 'Pick a glowing character'
            : canRoll
              ? 'Your turn: roll the dice!'
              : 'Rolling…'
        : `${nameOfSeat(activeSeat)}'s turn`;

  const rollLabel = canRoll
    ? '🎲 ROLL'
    : mustChoose
      ? 'Tap a glowing character'
      : spectator
        ? 'Spectating'
        : animating || rolling
          ? 'Rolling…'
          : 'Waiting…';

  const dock = finished ? undefined : (
    <>
      <RollingDice value={dice} rolling={rolling} size={64} />
      <div className="flex flex-col gap-1">
        <button
          disabled={!canRoll}
          onClick={roll}
          className={`rounded-2xl px-5 py-3 text-lg font-black text-[#263640] transition ${canRoll ? 'animate-pulse bg-[#ffbd43] shadow-lg hover:bg-[#ffd06d]' : 'bg-[#e8e1d2] opacity-70'}`}
        >
          {rollLabel}
        </button>
        {secondsLeft !== null && myTurn && <span className="text-center text-xs font-semibold text-[#71828c]">{secondsLeft}s left</span>}
      </div>
    </>
  );

  const side = (
    <>
      {finished && (
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Trophy size={20} className="text-amber-500" /> Results
          </h2>
          <ol className="mt-3 space-y-1.5">
            {game.ranking.map((seat, i) => (
              <li key={seat} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold">
                <span className="w-6 text-slate-400">{i + 1}.</span>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: playerColor(seat, N) }} />
                {nameOfSeat(seat)}
              </li>
            ))}
          </ol>
          {isHost ? (
            <button
              onClick={() => socket.emit('game:rematch')}
              className="mt-4 w-full rounded-2xl bg-[#ffbd43] p-4 font-black text-[#263640] hover:bg-[#ffd06d]"
            >
              Play again
            </button>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Waiting for the host to start another round.</p>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">
          {error}
        </p>
      )}

      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-black">Players</h2>
        <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {players.map((p) => (
            <li
              key={p.id}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${p.seat === activeSeat && !finished ? 'bg-amber-50 ring-2 ring-amber-300' : 'bg-slate-50'}`}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: playerColor(p.seat!, N) }} />
              <button
                onClick={() => {
                  setFollow(false);
                  setView(p.seat!);
                }}
                className="truncate text-left font-semibold"
                title="View from this home"
              >
                {p.nickname}
                {p.id === session.playerId && <span className="text-slate-400"> (you)</span>}
              </button>
              {p.isBot && <Bot size={14} className="shrink-0 text-slate-400" aria-label="Bot" />}
              {!p.connected && !p.isBot && <WifiOff size={14} className="shrink-0 text-rose-500" aria-label="Offline" />}
              <span className="ml-auto shrink-0 text-xs text-slate-500">
                {game.ranking.includes(p.seat!) ? `#${game.ranking.indexOf(p.seat!) + 1}` : `${homeCount(p.seat!)}/${perPlayer}`}
              </span>
            </li>
          ))}
        </ul>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#607987]">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          Camera follows the active player
        </label>
      </section>

      <RulesCard />

      <ChatPanel playerCount={N} className="h-72" />

      <button
        onClick={leaveRoom}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold"
      >
        <LogOut size={16} /> Leave room
      </button>
    </>
  );

  return (
    <GameStage
      color={playerColor(activeSeat, N)}
      title={status}
      subtitle={`Room ${snapshot.code}`}
      board={
        <Board3D
          ref={boardRef}
          game={game}
          validPieceIds={mustChoose ? validIds : []}
          onPieceClick={choose}
          showRoutes
          viewSeat={viewSeat}
          seatLabels={seatLabels}
        />
      }
      dock={dock}
      side={side}
    />
  );
}
