
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  DIFFICULTY_INFO,
  applyMove,
  chooseBotMove,
  createArenaGame,
  type Difficulty,
  finalRanking,
  isGameOver,
  seatsInPlay,
  legalMoves,
  resolveRoll,
  type GameSettings,
  type GameState,
  type MoveResult,
} from '@ludo-rush/shared';

import {
  Board3D,
  type Board3DHandle,
} from '../game/Board3D';

import { playerColor } from '../game/boardLayout';
import { ROLL_MS } from '../components/RollingDice';
import { GameStage } from '../components/GameStage';
import { Standings } from '../components/Standings';
import { TurnDock } from '../components/TurnDock';
import { RulesCard } from '../components/RulesCard';
import { DifficultyPicker } from '../components/DifficultyPicker';


type GamePhase =
  | 'SETUP'
  | 'ROLL'
  | 'CHOOSE'
  | 'ANIMATING'
  | 'PAUSING'
  | 'FINISHED';

const COLOR_NAMES = ['Red', 'Blue', 'Yellow', 'Green'];

const RANDOM_LIMIT = 0x100000000;

function randomInt(max: number): number {
  if (
    !Number.isSafeInteger(max) ||
    max < 1 ||
    max > RANDOM_LIMIT
  ) {
    throw new Error('Invalid random range');
  }

  const values = new Uint32Array(1);

  const limit =
    Math.floor(RANDOM_LIMIT / max) * max;

  let value: number;

  do {
    crypto.getRandomValues(values);
    value = values[0];
  } while (value >= limit);

  return value % max;
}


export function LocalGame({
  onExit,
}: {
  onExit: () => void;
}) {
  const seatsRef = useRef<number[]>([0, 1, 2, 3]);
  const [rolling, setRolling] = useState(false);

  const nameOf = useCallback((seat: number) => {
    if (seat === seatsRef.current[0]) return 'You';
    return `Computer (${COLOR_NAMES[seat] ?? `Player ${seat + 1}`})`;
  }, []);
  const isYou = (seat: number) => seat === seatsRef.current[0];

  const [playerCount, setPlayerCount] =
    useState(4);

  const [difficulty, setDifficulty] =
    useState<Difficulty>('MEDIUM');

  const [piecesPerPlayer, setPiecesPerPlayer] =
    useState<1 | 2 | 4>(4);

  const [game, setGame] =
    useState<GameState | null>(null);

  const [phase, setPhase] =
    useState<GamePhase>('SETUP');

  const [legalIds, setLegalIds] =
    useState<string[]>([]);

  const [dice, setDice] =
    useState<number | null>(null);

  const [ranking, setRanking] =
    useState<number[]>([]);

  const [activity, setActivity] =
    useState<string[]>([
      'Welcome to Ludo Rush.',
    ]);

  const boardRef =
    useRef<Board3DHandle>(null);

  const gameRef =
    useRef<GameState | null>(null);

  const settingsRef =
    useRef<GameSettings | null>(null);

  const legalRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  const timerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const visibleGame = game;

  const seatLabels: Record<number, string> = game
    ? Object.fromEntries(seatsInPlay(game).map(seat => [seat, nameOf(seat)]))
    : {};
  const activeSeat = game?.turnSeat ?? 0;

  // The board never turns; your home is always bottom-left.
  const humanSeat = seatsRef.current[0] ?? 0;
  const viewSeat = humanSeat;
  const yourTurn = activeSeat === humanSeat;

  const log = useCallback(
    (message: string) => {
      setActivity(old =>
        [message, ...old].slice(0, 15)
      );
    },
    []
  );

  const updateGame = useCallback(
    (next: GameState | null) => {
      gameRef.current = next;
      setGame(next);
    },
    []
  );

  const updateLegal = useCallback(
    (ids: string[]) => {
      legalRef.current = ids;
      setLegalIds(ids);
    },
    []
  );

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, []);

  const startGame = () => {
    if (busyRef.current) return;

    clearTimer();

    const arena = createArenaGame(
      playerCount,
      piecesPerPlayer,
      difficulty
    );

    const settings = arena.settings;
    const next = arena.game;
    seatsRef.current = arena.seats;

    settingsRef.current = settings;

    updateGame(next);
    updateLegal([]);
    setDice(null);
    setRanking([]);
    setPhase('ROLL');

    setActivity([
      `You vs ${playerCount - 1} computer${playerCount > 2 ? 's' : ''}, ${DIFFICULTY_INFO[difficulty].label} mode.`,
      'You roll first.',
    ]);

    boardRef.current?.resetView();
  };

  const restart = () => {
    if (busyRef.current) return;

    clearTimer();

    settingsRef.current = null;

    updateGame(null);
    updateLegal([]);
    setDice(null);
    setRanking([]);
    setPhase('SETUP');

    setActivity([]);
  };

  const rollDice = () => {
    if (
      phase !== 'ROLL' ||
      busyRef.current
    ) {
      return;
    }

    const current = gameRef.current;
    const settings = settingsRef.current;

    if (!current || !settings) return;

    // A roll is already waiting for a move: never roll again on top of it.
    if (current.dice !== null) return;

    busyRef.current = true;
    setRolling(true);
    updateLegal([]);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (!mountedRef.current) return;
      setRolling(false);
      revealRoll(current, settings);
    }, ROLL_MS);
  };

  const revealRoll = (
    current: GameState,
    settings: GameSettings
  ) => {
    try {
      const value =
        randomInt(6) + 1;

      const result = resolveRoll(
        current,
        value,
        settings
      );

      setDice(value);
      updateLegal([]);

      log(
        `${nameOf(current.turnSeat)} rolled ${value}.`
      );

      if (
        result.cancelled ||
        result.validPieceIds.length === 0
      ) {
        setPhase('PAUSING');

        log(
          result.cancelled
            ? 'Third consecutive six! Turn cancelled.'
            : 'No legal move. Next player!'
        );

        timerRef.current = setTimeout(
          () => {
            timerRef.current = null;

            if (!mountedRef.current) return;

            updateGame(result.game);
            setDice(null);
            setPhase('ROLL');

            busyRef.current = false;
          },
          900
        );

        return;
      }

      updateGame(result.game);
      updateLegal(
        result.validPieceIds
      );
      setPhase('CHOOSE');

      busyRef.current = false;

      // Only one possible move: play it for the player after a short beat.
      if (result.validPieceIds.length === 1) {
        const only = result.validPieceIds[0]!;
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (mountedRef.current) void choosePieceRef.current(only);
        }, 800);
      }
    } catch (error) {
      console.error(error);
      log('Dice roll failed.');

      setPhase('ROLL');
      busyRef.current = false;
    }
  };

  const finishMove = useCallback(
    (result: MoveResult) => {
      const next = result.game;

      const attacker = next.pieces.find(
        piece => piece.id === result.pieceId
      );

      for (const capture of result.captures) {
        const victim = next.pieces.find(
          piece => piece.id === capture.victimId
        );

        if (attacker && victim) {
          const effectName =
            capture.style === 'SLAP'
              ? 'slapped'
              : capture.style === 'DOG'
                ? 'sent a dog chasing'
                : 'shot with a cartoon gun';

          log(
            `${nameOf(attacker.ownerSeat)} ${effectName} ${nameOf(victim.ownerSeat)}!`
          );
        }
      }

      if (result.pieceHome && attacker) {
        log(
          `${nameOf(attacker.ownerSeat)} reached home!`
        );
      }

      if (result.playerFinished && attacker) {
        log(
          `🏁 ${nameOf(attacker.ownerSeat)} finished all characters!`
        );
      }

      updateGame(next);
      updateLegal([]);
      setDice(null);

      if (isGameOver(next)) {
        const finalRanks = finalRanking(next);

        setRanking(finalRanks);
        setPhase('FINISHED');

        log(
          `🏆 ${nameOf(finalRanks[0])} ${isYou(finalRanks[0]) ? 'win' : 'wins'}!`
        );
      } else {
        if (result.extraTurn) {
          log(
            `${nameOf(next.turnSeat)} ${isYou(next.turnSeat) ? 'get' : 'gets'} another turn!`
          );
        }

        setPhase('ROLL');
      }
    },
    [log, updateGame, updateLegal]
  );

  const choosePieceRef = useRef<(id: string) => Promise<void>>(async () => undefined);

  const choosePiece = useCallback(
    async (pieceId: string) => {
      if (busyRef.current) return;

      const current = gameRef.current;
      const settings = settingsRef.current;

      if (
        !current ||
        !settings ||
        current.dice === null ||
        !legalRef.current.includes(pieceId)
      ) {
        return;
      }

      const previousLegal = [
        ...legalRef.current,
      ];

      busyRef.current = true;
      setPhase('ANIMATING');
      updateLegal([]);

      try {
        const result = applyMove(
          current,
          pieceId,
          settings,
          randomInt
        );

        await boardRef.current?.playMove(
          result
        );

        if (!mountedRef.current) return;

        finishMove(result);
      } catch (error) {
        console.error(error);

        if (mountedRef.current) {
          const restored = previousLegal.length
            ? previousLegal
            : legalMoves(
              current,
              current.turnSeat,
              current.dice,
              settings
            );

          updateLegal(restored);
          setPhase('CHOOSE');

          log(
            'Move interrupted. Select a character again.'
          );
        }
      } finally {
        busyRef.current = false;
      }
    },
    [finishMove, log, updateLegal]
  );
  choosePieceRef.current = choosePiece;

  // Only you can tap characters; the computer plays its own turns.
  const pickByHuman = (id: string) => {
    const current = gameRef.current;
    if (!current || current.turnSeat !== seatsRef.current[0]) return;
    void choosePiece(id);
  };

  const rollByHuman = () => {
    const current = gameRef.current;
    if (!current || current.turnSeat !== seatsRef.current[0]) return;
    rollDice();
  };

  // Computer turns: roll, then pick a move after a short beat.
  useEffect(() => {
    if (!game || game.turnSeat === seatsRef.current[0]) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (phase === 'ROLL') {
      t = setTimeout(() => rollDice(), 800);
    } else if (phase === 'CHOOSE' && legalIds.length > 1 && settingsRef.current) {
      const settings = settingsRef.current;
      t = setTimeout(() => {
        const cur = gameRef.current;
        if (!cur || !mountedRef.current) return;
        void choosePieceRef.current(chooseBotMove(cur, settings, legalRef.current));
      }, 1000);
    }
    return () => { if (t) clearTimeout(t); };
  }, [phase, game, legalIds, rolling]);

  const homeCount = (seat: number) => {
    if (!game) return 0;

    return game.pieces.filter(
      piece =>
        piece.ownerSeat === seat &&
        piece.progress ===
        game.L + game.H
    ).length;
  };

  const settings = settingsRef.current;

  /* ------------------------------ setup screen ------------------------------ */
  if (phase === 'SETUP' || !game) {
    return (
      <div className="table-bg fixed inset-0 z-30 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="font-title text-4xl text-[var(--cream)] drop-shadow-[0_3px_0_var(--ink)]">You vs computer</h1>
            <button onClick={onExit} className="btn btn-paper btn-small">Back</button>
          </div>

          <div className="grid gap-5">
            <section className="panel p-5">
              <p className="label">Difficulty</p>
              <div className="mt-2">
                <DifficultyPicker value={difficulty} onChange={setDifficulty} />
              </div>
            </section>

            <section className="panel space-y-5 p-5">
              <div>
                <p className="label">Computer opponents</p>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3].map(n => (
                    <button key={n} aria-pressed={playerCount === n + 1} onClick={() => setPlayerCount(n + 1)} className="chip flex-1 text-xl">
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="label">Characters each</p>
                <div className="mt-2 flex gap-2">
                  {([1, 2, 4] as const).map(n => (
                    <button key={n} aria-pressed={piecesPerPlayer === n} onClick={() => setPiecesPerPlayer(n)} className="chip flex-1 text-xl">
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs font-bold text-[var(--ink-soft)]">1 = quick game, 4 = classic</p>
              </div>

              <button onClick={startGame} className="btn btn-red w-full !py-4 text-2xl">Start game</button>
            </section>

          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------- game screen ------------------------------- */
  const dock =
    phase === 'FINISHED' ? undefined : (
      <TurnDock
        color={playerColor(activeSeat, game.N)}
        who={yourTurn ? 'Your turn' : `${nameOf(activeSeat)}'s turn`}
        dice={dice}
        rolling={rolling}
        canRoll={phase === 'ROLL' && yourTurn}
        onRoll={rollByHuman}
      />
    );

  const side = (
    <>
      {phase === 'FINISHED' && (
        <section className="panel p-4">
          <p className="panel-title">Game over</p>
          <ol className="mt-2 space-y-1.5">
            {ranking.map((seat, i) => (
              <li key={seat} className="flex items-center gap-2 font-extrabold">
                <span className="w-6 text-[var(--ink-soft)]">{i + 1}.</span>
                <span className="h-4 w-4 rounded-full border-2 border-[var(--ink)]" style={{ backgroundColor: playerColor(seat, game.N) }} />
                {nameOf(seat)}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex gap-2">
            <button onClick={restart} className="btn btn-red flex-1">New game</button>
            <button onClick={onExit} className="btn btn-paper flex-1">Menu</button>
          </div>
        </section>
      )}

      {phase === 'CHOOSE' && yourTurn && legalIds.length > 1 && (
        <section className="panel p-4">
          <p className="panel-title mb-2">Or pick here</p>
          <div className="flex flex-wrap gap-2">
            {legalIds.map(id => (
              <button key={id} onClick={() => pickByHuman(id)} className="btn btn-small">
                Move character {Number(id.split('-p')[1] ?? 0) + 1}
              </button>
            ))}
          </div>
        </section>
      )}

      <Standings
        rows={seatsInPlay(game).map(seat => ({
          key: String(seat),
          name: nameOf(seat),
          color: playerColor(seat, game.N),
          home: homeCount(seat),
          total: settings?.piecesPerPlayer ?? 4,
          rank: ranking.includes(seat) ? ranking.indexOf(seat) + 1 : undefined,
          active: seat === activeSeat && phase !== 'FINISHED',
        }))}
      />

      <section className="panel p-4">
        <p className="panel-title mb-2">What happened</p>
        <div className="max-h-44 space-y-1 overflow-y-auto text-sm font-bold">
          {activity.map((m, i) => (
            <p key={`${i}-${m}`} className={i === 0 ? '' : 'text-[var(--ink-soft)]'}>{m}</p>
          ))}
        </div>
      </section>

      <RulesCard difficulty={settings?.difficulty ?? 'MEDIUM'} />

      <div className="flex gap-2">
        <button onClick={restart} className="btn btn-paper btn-small flex-1">Restart</button>
        <button onClick={onExit} className="btn btn-paper btn-small flex-1">Leave</button>
      </div>
    </>
  );

  return (
    <GameStage
      color={playerColor(activeSeat, game.N)}
      title={phase === 'FINISHED' ? 'Game over' : yourTurn ? 'Your turn' : `${nameOf(activeSeat)}'s turn`}
      subtitle={`${DIFFICULTY_INFO[settings?.difficulty ?? 'MEDIUM'].label} mode`}
      board={
        <Board3D
          ref={boardRef}
          game={visibleGame!}
          seatLabels={seatLabels}
          validPieceIds={yourTurn ? legalIds : []}
          onPieceClick={pickByHuman}
          showRoutes
          viewSeat={viewSeat}
          starsPerSegment={settings?.starTilesPerSegment ?? 1}
        />
      }
      dock={dock}
      side={side}
      sideLabel="Players & rules"
    />
  );
}
