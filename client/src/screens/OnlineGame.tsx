import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, WifiOff } from 'lucide-react';
import { DIFFICULTY_INFO, arenaSettings, capturingMoves, type GameState, type TurnInfo } from '@ludo-rush/shared';
import { Board3D, type Board3DHandle } from '../game/Board3D';
import { playerColor } from '../game/boardLayout';
import { GameStage } from '../components/GameStage';
import { RulesCard } from '../components/RulesCard';
import { ChatPanel } from '../components/ChatPanel';
import { play } from '../audio/sfx';
import { ROLL_MS } from '../components/RollingDice';
import { TurnDock } from '../components/TurnDock';
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

  const difficulty = snapshot.options.difficulty ?? 'MEDIUM';
  const settings = useMemo(
    () => arenaSettings(players.length, 4, difficulty),
    [players.length, difficulty],
  );
  const captureIds =
    myTurn && game.dice !== null && validIds.length > 0 && !animating ? capturingMoves(game, settings) : [];
  const warnHard =
    settings.missedCapturePenalty && captureIds.length > 0 && validIds.length > 1
      ? 'Hard rule: you can capture! If you move another character, your capturing character goes home.'
      : null;

  const hint = finished
    ? ''
    : spectator
      ? `You are watching ${nameOfSeat(activeSeat)}`
      : myTurn
        ? animating
          ? 'Watch your move'
          : mustChoose
            ? `Tap one of the glowing characters to move ${dice} steps`
            : canRoll
              ? 'Press ROLL'
              : 'Rolling…'
        : `Waiting for ${nameOfSeat(activeSeat)}`;

  const dock = finished ? undefined : (
    <TurnDock
      color={playerColor(activeSeat, N)}
      who={myTurn ? 'YOUR TURN' : `${nameOfSeat(activeSeat)}'s turn`}
      hint={hint}
      warn={warnHard}
      dice={dice}
      rolling={rolling}
      canRoll={canRoll}
      onRoll={roll}
      yourTurn={myTurn}
      secondsLeft={myTurn ? secondsLeft : null}
    />
  );

  const side = (
    <>
      {finished && (
        <section className="panel p-4">
          <p className="panel-title">Results</p>
          <ol className="mt-2 space-y-1.5">
            {game.ranking.map((seat, i) => (
              <li key={seat} className="flex items-center gap-2 font-extrabold">
                <span className="w-6 text-[var(--ink-soft)]">{i + 1}.</span>
                <span className="h-4 w-4 rounded-full border-2 border-[var(--ink)]" style={{ backgroundColor: playerColor(seat, N) }} />
                {nameOfSeat(seat)}
              </li>
            ))}
          </ol>
          {isHost ? (
            <button onClick={() => socket.emit('game:rematch')} className="btn btn-red mt-4 w-full">
              Play again
            </button>
          ) : (
            <p className="mt-3 text-sm font-bold text-[var(--ink-soft)]">Waiting for the host to start another round.</p>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="panel bg-[var(--red)] p-3 text-sm font-extrabold text-white">
          {error}
        </p>
      )}

      <section className="panel p-4">
        <p className="panel-title mb-2">Players</p>
        <ul className="space-y-1.5">
          {players.map((p) => (
            <li
              key={p.id}
              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 font-extrabold ${p.seat === activeSeat && !finished ? 'border-[var(--ink)] bg-[var(--yellow)]' : 'border-transparent'}`}
            >
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-[var(--ink)]" style={{ backgroundColor: playerColor(p.seat!, N) }} />
              <button
                onClick={() => {
                  setFollow(false);
                  setView(p.seat!);
                }}
                className="truncate text-left"
                title="View from this home"
              >
                {p.nickname}
                {p.id === session.playerId && <span className="text-[var(--ink-soft)]"> (you)</span>}
              </button>
              {p.isBot && <Bot size={14} className="shrink-0" aria-label="Bot" />}
              {!p.connected && !p.isBot && <WifiOff size={14} className="shrink-0 text-[var(--red)]" aria-label="Offline" />}
              <span className="ml-auto shrink-0 text-sm text-[var(--ink-soft)]">
                {game.ranking.includes(p.seat!) ? `#${game.ranking.indexOf(p.seat!) + 1}` : `${homeCount(p.seat!)}/${perPlayer} home`}
              </span>
            </li>
          ))}
        </ul>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="h-4 w-4 accent-[var(--red)]" />
          Camera follows whose turn it is
        </label>
      </section>

      <RulesCard difficulty={difficulty} />

      <ChatPanel playerCount={N} className="h-72" />

      <button onClick={leaveRoom} className="btn btn-paper btn-small w-full">
        Leave room
      </button>
    </>
  );

  return (
    <GameStage
      color={playerColor(activeSeat, N)}
      title={finished ? 'Game over' : myTurn ? 'Your turn' : `${nameOfSeat(activeSeat)}'s turn`}
      subtitle={`Room ${snapshot.code} · ${DIFFICULTY_INFO[difficulty].label}`}
      board={
        <Board3D
          ref={boardRef}
          game={game}
          validPieceIds={mustChoose ? validIds : []}
          onPieceClick={choose}
          showRoutes
          viewSeat={viewSeat}
          seatLabels={seatLabels}
          starsPerSegment={settings.starTilesPerSegment}
        />
      }
      dock={dock}
      side={side}
    />
  );
}
