
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ArrowRight,
  Camera,
  CheckCircle2,
  RotateCcw,
  Route,
  Trophy,
} from 'lucide-react';

import {
  applyMove,
  createArenaGame,
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
import { ROLL_MS, RollingDice } from '../components/RollingDice';
import { GameStage } from '../components/GameStage';
import { RulesCard } from '../components/RulesCard';


type GamePhase =
  | 'SETUP'
  | 'ROLL'
  | 'CHOOSE'
  | 'ANIMATING'
  | 'PAUSING'
  | 'FINISHED';

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

  const nameOf = useCallback(
    (seat: number) =>
      `Player ${Math.max(0, seatsRef.current.indexOf(seat)) + 1}`,
    []
  );

  const [playerCount, setPlayerCount] =
    useState(4);

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

  const [selectedView, setSelectedView] =
    useState(0);

  const [autoRotate, setAutoRotate] =
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

  const previewGame = useMemo(
    () => createArenaGame(playerCount, piecesPerPlayer).game,
    [playerCount, piecesPerPlayer]
  );

  const visibleGame = game ?? previewGame;

  const seatLabels = Object.fromEntries(
    seatsInPlay(visibleGame).map(seat => [
      seat,
      nameOf(seat).replace('Player ', 'P'),
    ])
  );
  const activeSeat = game?.turnSeat ?? 0;

  const viewSeat =
    autoRotate && game && phase !== 'FINISHED'
      ? activeSeat
      : selectedView;

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
      piecesPerPlayer
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
      `${playerCount} players joined the arena.`,
      `${nameOf(0)} rolls first.`,
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
      `Capture test (${style}): roll, then pick the glowing character. Player 1 captures Player 2.`,
    ]);
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

    setActivity([
      'Choose your game settings.',
    ]);
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

  const instruction =
    phase === 'SETUP'
      ? 'Choose players and your preferred home view.'
      : phase === 'ROLL'
        ? 'Roll the dice to start your move.'
        : phase === 'CHOOSE'
          ? 'Select one of the glowing characters.'
          : phase === 'ANIMATING'
            ? 'Watch the character animation.'
            : phase === 'PAUSING'
              ? 'Passing to the next player...'
              : 'Final rankings are ready.';

  const dock =
    phase === 'SETUP' || phase === 'FINISHED' ? undefined : (
      <>
        <RollingDice value={dice} rolling={rolling} size={64} />
        <button
          disabled={phase !== 'ROLL'}
          onClick={rollDice}
          className={`rounded-2xl px-5 py-3 text-lg font-black text-[#263640] transition ${phase === 'ROLL' ? 'animate-pulse bg-[#ffbd43] shadow-lg hover:bg-[#ffd06d]' : 'bg-[#e8e1d2] opacity-70'}`}
        >
          {phase === 'ROLL'
            ? '🎲 ROLL'
            : phase === 'CHOOSE'
              ? 'Tap a glowing character'
              : '…'}
        </button>
      </>
    );

  const side = (
    <>

            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-[#188e7d]">
                <Camera size={18} />
                <h2 className="font-black">
                  Camera viewpoint
                </h2>
              </div>

              <label
                htmlFor="camera-seat"
                className="text-sm font-semibold"
              >
                View from home
              </label>

              <select
                id="camera-seat"
                value={selectedView}
                onChange={event => {
                  setSelectedView(
                    Number(event.target.value)
                  );
                  setAutoRotate(false);
                }}
                className="mt-2 w-full rounded-xl border border-[#d7e4e3] bg-[#f5faf8] p-3 text-sm"
              >
                {seatsInPlay(visibleGame).map(
                  (seat) => (
                    <option
                      key={seat}
                      value={seat}
                    >
                      {nameOf(seat)}'s home
                    </option>
                  )
                )}
              </select>

              <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={event =>
                    setAutoRotate(
                      event.target.checked
                    )
                  }
                  className="accent-emerald-600"
                />

                Auto-rotate to active player
              </label>

              <p className="mt-2 text-xs text-slate-500">
                Turn this off to keep the camera
                on your selected home.
              </p>
            </section>

            {phase === 'SETUP' ? (
              <section className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black">
                    One-device game
                  </h2>

                  <button
                    onClick={onExit}
                    className="text-xs font-bold text-slate-500 underline"
                  >
                    Menu
                  </button>
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  Four players use the classic board.
                  Larger groups use a compact arena.
                </p>

                <label
                  htmlFor="players"
                  className="mt-6 flex justify-between text-sm font-semibold"
                >
                  Players
                  <strong className="text-xl">
                    {playerCount}
                  </strong>
                </label>

                <input
                  id="players"
                  type="range"
                  min="2"
                  max="20"
                  value={playerCount}
                  onChange={event => {
                    const value = Number(
                      event.target.value
                    );

                    setPlayerCount(value);

                    setSelectedView(old =>
                      Math.min(old, value - 1)
                    );

                    setPiecesPerPlayer(
                      value > 8 ? 1 : 4
                    );
                  }}
                  className="mt-3 w-full accent-emerald-600"
                />

                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>2</span>
                  <span>20</span>
                </div>

                <p className="mb-3 mt-5 text-sm font-semibold">
                  Characters per player
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {([1, 2, 4] as const).map(
                    count => (
                      <button
                        key={count}
                        onClick={() =>
                          setPiecesPerPlayer(
                            count
                          )
                        }
                        className={`rounded-xl border-2 p-3 font-bold ${piecesPerPlayer === count
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-100 bg-slate-50'
                          }`}
                      >
                        {count}
                      </button>
                    )
                  )}
                </div>

                <div className="mt-4 rounded-xl bg-[#eff8f1] p-3 text-sm text-[#476c5f]">
                  {visibleGame.L} shared track tiles
                  across {seatsInPlay(visibleGame).length} players.
                </div>

                <button
                  onClick={startGame}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#21aa70] p-4 font-black text-white hover:bg-[#178859]"
                >
                  Start game
                  <ArrowRight size={18} />
                </button>
              </section>
            ) : (
              <section className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Current turn
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {phase === 'FINISHED'
                    ? 'Game over!'
                    : nameOf(activeSeat)}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  {instruction}
                </p>

                {phase === 'CHOOSE' && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-semibold">
                      Available characters
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {legalIds.map(id => (
                        <button
                          key={id}
                          onClick={() =>
                            choosePiece(id)
                          }
                          className="rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800"
                        >
                          Character{' '}
                          {Number(
                            id.split('-p')[1]
                          ) + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  disabled={
                    phase === 'ANIMATING' ||
                    phase === 'PAUSING'
                  }
                  onClick={restart}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 p-3 font-semibold disabled:opacity-40"
                >
                  <RotateCcw size={16} />
                  New game
                </button>

                <button
                  onClick={onExit}
                  className="mt-2 w-full rounded-xl p-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Back to menu
                </button>
              </section>
            )}

            {phase === 'FINISHED' && (
              <section className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-amber-600">
                  <Trophy size={21} />
                  <h2 className="font-black">
                    Final rankings
                  </h2>
                </div>

                {ranking.map((seat, index) => (
                  <div
                    key={seat}
                    className="mb-2 flex justify-between rounded-xl bg-slate-50 p-3 text-sm"
                  >
                    <span>
                      #{index + 1} · {nameOf(seat)}
                    </span>

                    {index === 0 && (
                      <span>🏆</span>
                    )}
                  </div>
                ))}
              </section>
            )}

            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-black">
                Game activity
              </h2>

              <div className="max-h-48 space-y-2 overflow-y-auto">
                {activity.map(
                  (message, index) => (
                    <p
                      key={`${index}-${message}`}
                      className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"
                    >
                      {message}
                    </p>
                  )
                )}
              </div>
            </section>


            <section className="rounded-3xl border-2 border-dashed border-violet-300 bg-violet-50 p-5">
              <h2 className="font-black text-violet-900">
                Test tools
              </h2>
              <p className="mt-1 text-xs text-violet-800">
                Skip the long game and see a capture scene right away.
              </p>

              <p className="mt-3 text-sm font-semibold">
                Capture scene in one roll
              </p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {(
                  [
                    ['GUN', '🔫 Gun'],
                    ['SLAP', '👋 Slap'],
                    ['DOG', '🐕 Dog'],
                  ] as const
                ).map(([style, label]) => (
                  <button
                    key={style}
                    onClick={() => startCaptureDemo(style)}
                    className="rounded-xl bg-white p-2 text-sm font-bold shadow-sm hover:bg-violet-100"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={startHomeDemo}
                className="mt-3 w-full rounded-xl bg-white p-2 text-sm font-bold shadow-sm hover:bg-violet-100"
              >
                🏁 Home stretch (4 players near home)
              </button>

              <p className="mt-3 text-sm font-semibold">
                Force the next dice
              </p>
              <div className="mt-1 grid grid-cols-6 gap-1.5">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() =>
                      forceDice(forcedDice === n ? null : n)
                    }
                    className={`rounded-lg p-2 text-sm font-black ${forcedDice === n
                      ? 'bg-violet-600 text-white'
                      : 'bg-white shadow-sm'
                      }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-black">Players</h2>
            {game && (
              <div className="grid grid-cols-2 gap-2">
                {seatsInPlay(game).map(
                  (seat) => (
                    <div
                      key={seat}
                      className={`rounded-2xl border-2 p-3 ${seat === activeSeat &&
                          phase !== 'FINISHED'
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-white bg-white'
                        }`}
                    >
                      <div className="flex items-center gap-2 font-bold">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: playerColor(
                              seat,
                              game.N
                            ),
                          }}
                        />

                        {nameOf(seat).replace("Player ", "P")}
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        {homeCount(seat)}/
                        {settingsRef.current?.piecesPerPlayer ??
                          4}{' '}
                        finished
                      </p>

                      {game.ranking.includes(seat) && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 size={13} />
                          Finished
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

        <div className="mt-3 text-xs text-[#607987]">
              <label className="flex cursor-pointer items-center gap-2 font-semibold">
                <Route size={15} />
                Show move paths

                <input
                  type="checkbox"
                  checked={showRoutes}
                  onChange={event =>
                    setShowRoutes(
                      event.target.checked
                    )
                  }
                  className="accent-emerald-600"
                />
              </label>

        </div>
      </section>

      <RulesCard />
    </>
  );

  return (
    <GameStage
      color={playerColor(activeSeat, visibleGame.N)}
      title={
        phase === 'SETUP'
          ? 'Explore the arena'
          : phase === 'FINISHED'
            ? 'Game complete'
            : `${nameOf(activeSeat)}'s turn`
      }
      subtitle={instruction}
      board={
        <Board3D
          ref={boardRef}
          game={visibleGame}
          seatLabels={seatLabels}
          validPieceIds={legalIds}
          onPieceClick={choosePiece}
          showRoutes={showRoutes}
          viewSeat={viewSeat}
          starsPerSegment={settingsRef.current?.starTilesPerSegment ?? 1}
        />
      }
      dock={dock}
      side={side}
      sideLabel="Menu & players"
    />
  );
}
