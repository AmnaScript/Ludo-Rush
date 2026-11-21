
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  DIFFICULTY_INFO,
  applyMove,
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
  const forcedDiceRef = useRef<number | null>(null);
  const [forcedDice, setForcedDice] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);

  const nameOf = useCallback((seat: number) => COLOR_NAMES[seat] ?? `Player ${seat + 1}`, []);

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

  const [showRoutes, setShowRoutes] =
    useState(true);

  const [activity, setActivity] =
    useState<string[]>([
      'Welcome to the new Ludo Rush arena.',
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

  // The board never turns between players.
  const viewSeat = 0;

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
      `${playerCount} players, ${DIFFICULTY_INFO[difficulty].label} mode.`,
      `${nameOf(arena.seats[0]!)} rolls first.`,
    ]);

    boardRef.current?.resetView();
  };

  /** Test helper: a two-player game where the next roll (forced to 2) captures. */
  const startCaptureDemo = (style: 'GUN' | 'SLAP' | 'DOG') => {
    clearTimer();
    busyRef.current = false;

    const arena = createArenaGame(2, 1);
    const settings: GameSettings = {
      ...arena.settings,
      captureStyles: { GUN: 0, SLAP: 0, DOG: 0, [style]: 1 },
    };
    const next: GameState = {
      ...arena.game,
      pieces: arena.game.pieces.map(piece => ({
        ...piece,
        // seat 0 sits two tiles behind seat 2's piece on a normal tile
        progress: piece.ownerSeat === 0 ? 10 : 38,
      })),
    };

    seatsRef.current = arena.seats;
    settingsRef.current = settings;
    forcedDiceRef.current = 2;
    setForcedDice(2);

    updateGame(next);
    updateLegal([]);
    setDice(null);
    setRanking([]);
    setPhase('ROLL');
    setActivity([
      `Capture test (${style}): roll, then pick the glowing character. Red captures Yellow.`,
    ]);
    boardRef.current?.resetView();
  };

  /** Test helper: Hard mode, Red can capture Yellow but also has another move. */
  const startPenaltyDemo = () => {
    clearTimer();
    busyRef.current = false;

    const arena = createArenaGame(2, 2, 'HARD');
    const progress: Record<string, number> = { 's0-p0': 10, 's0-p1': 30, 's2-p0': 38, 's2-p1': 30 };
    const next: GameState = {
      ...arena.game,
      pieces: arena.game.pieces.map(piece => ({ ...piece, progress: progress[piece.id] ?? -1 })),
    };

    seatsRef.current = arena.seats;
    settingsRef.current = arena.settings;
    forcedDiceRef.current = 2;
    setForcedDice(2);
    updateGame(next);
    updateLegal([]);
    setDice(null);
    setRanking([]);
    setPhase('ROLL');
    setActivity(['Hard rule test: Red can capture with one character. Move the OTHER one and see what happens.']);
    boardRef.current?.resetView();
  };

  /** Test helper: four players with most characters already near or in home. */
  const startHomeDemo = () => {
    clearTimer();
    busyRef.current = false;

    const arena = createArenaGame(4, 4);
    const finished = arena.game.L + arena.game.H;
    const stages = [finished, finished, arena.game.L + 3, arena.game.L - 4];
    const next: GameState = {
      ...arena.game,
      pieces: arena.game.pieces.map(piece => ({
        ...piece,
        progress: stages[Number(piece.id.split('-p')[1] ?? 0) % 4]!,
      })),
    };

    seatsRef.current = arena.seats;
    settingsRef.current = arena.settings;
    updateGame(next);
    updateLegal([]);
    setDice(null);
    setRanking([]);
    setPhase('ROLL');
    setActivity(['Home stretch test: look at how the finish area and home lanes are used.']);
    boardRef.current?.resetView();
  };

  const forceDice = (value: number | null) => {
    forcedDiceRef.current = value;
    setForcedDice(value);
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
        forcedDiceRef.current ?? randomInt(6) + 1;
      forcedDiceRef.current = null;
      setForcedDice(null);

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
          `🏆 ${nameOf(finalRanks[0])} wins!`
        );
      } else {
        if (result.extraTurn) {
          log(
            `${nameOf(next.turnSeat)} gets another turn!`
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
            <h1 className="font-title text-4xl text-[var(--cream)] drop-shadow-[0_3px_0_var(--ink)]">New game</h1>
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
                <p className="label">Players on this device</p>
                <div className="mt-2 flex gap-2">
                  {[2, 3, 4].map(n => (
                    <button key={n} aria-pressed={playerCount === n} onClick={() => setPlayerCount(n)} className="chip flex-1 text-xl">
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

            <section className="panel p-5 md:col-span-2">
              <p className="panel-title">Test lab</p>
              <p className="text-sm font-bold text-[var(--ink-soft)]">Skip the long game: jump straight into a scene.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-paper btn-small" onClick={() => startCaptureDemo('GUN')}>Gun capture</button>
                <button className="btn btn-paper btn-small" onClick={() => startCaptureDemo('SLAP')}>Slap capture</button>
                <button className="btn btn-paper btn-small" onClick={() => startCaptureDemo('DOG')}>Dog capture</button>
                <button className="btn btn-paper btn-small" onClick={startPenaltyDemo}>Hard-mode penalty</button>
                <button className="btn btn-paper btn-small" onClick={startHomeDemo}>Home stretch</button>
              </div>
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
        who={`${nameOf(activeSeat)}'s turn`}
        dice={dice}
        rolling={rolling}
        canRoll={phase === 'ROLL'}
        onRoll={rollDice}
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

      {phase === 'CHOOSE' && legalIds.length > 1 && (
        <section className="panel p-4">
          <p className="panel-title mb-2">Or pick here</p>
          <div className="flex flex-wrap gap-2">
            {legalIds.map(id => (
              <button key={id} onClick={() => choosePiece(id)} className="btn btn-small">
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

      <label className="panel flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-bold">
        <input type="checkbox" checked={showRoutes} onChange={e => setShowRoutes(e.target.checked)} className="h-4 w-4 accent-[var(--brass)]" />
        Show where the character will land
      </label>

      <section className="panel p-4">
        <p className="panel-title mb-2">What happened</p>
        <div className="max-h-44 space-y-1 overflow-y-auto text-sm font-bold">
          {activity.map((m, i) => (
            <p key={`${i}-${m}`} className={i === 0 ? '' : 'text-[var(--ink-soft)]'}>{m}</p>
          ))}
        </div>
      </section>

      <RulesCard difficulty={settings?.difficulty ?? 'MEDIUM'} />

      <details className="panel p-4">
        <summary className="panel-title cursor-pointer">Test lab</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-paper btn-small" onClick={() => startCaptureDemo('GUN')}>Gun</button>
          <button className="btn btn-paper btn-small" onClick={() => startCaptureDemo('SLAP')}>Slap</button>
          <button className="btn btn-paper btn-small" onClick={() => startCaptureDemo('DOG')}>Dog</button>
          <button className="btn btn-paper btn-small" onClick={startPenaltyDemo}>Hard penalty</button>
        </div>
        <p className="label mt-3">Force the next dice</p>
        <div className="mt-1 grid grid-cols-6 gap-1.5">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <button key={n} aria-pressed={forcedDice === n} onClick={() => forceDice(forcedDice === n ? null : n)} className="chip !px-0 !py-1 text-center">
              {n}
            </button>
          ))}
        </div>
      </details>

      <div className="flex gap-2">
        <button onClick={restart} className="btn btn-paper btn-small flex-1">Restart</button>
        <button onClick={onExit} className="btn btn-paper btn-small flex-1">Leave</button>
      </div>
    </>
  );

  return (
    <GameStage
      color={playerColor(activeSeat, game.N)}
      title={phase === 'FINISHED' ? 'Game over' : `${nameOf(activeSeat)}'s turn`}
      subtitle={`${DIFFICULTY_INFO[settings?.difficulty ?? 'MEDIUM'].label} mode`}
      board={
        <Board3D
          ref={boardRef}
          game={visibleGame!}
          seatLabels={seatLabels}
          validPieceIds={legalIds}
          onPieceClick={choosePiece}
          showRoutes={showRoutes}
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
