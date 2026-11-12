
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
  Dice5,
  Focus,
  Minus,
  Plus,
  RotateCcw,
  Route,
  Trophy,
  Wifi,
  WifiOff,
} from 'lucide-react';

import {
  applyMove,
  createGame,
  createSettings,
  legalMoves,
  resolveRoll,
  type GameSettings,
  type GameState,
  type MoveResult,
} from '@ludo-rush/shared';

import {
  Board3D,
  type Board3DHandle,
} from './game/Board3D';

import {
  playerColor,
  segmentForPlayers,
} from './game/boardLayout';

import { socket } from './net/socket';
import { useConnectionStore } from './store/connectionStore';

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

function nameOf(seat: number) {
  return `Player ${seat + 1}`;
}

function gameSettings(
  count: number,
  pieces: 1 | 2 | 4
): GameSettings {
  return createSettings(count, {
    piecesPerPlayer: pieces,
    segmentSize: segmentForPlayers(count),
    laneLength: 6,
    captureStyles: {
      SLAP: 1,
      DOG: 1,
      GUN: 1,
    },
  });
}

export default function App() {
  const {
    connected,
    status,
    setConnected,
    setStatus,
  } = useConnectionStore();

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

  const [pingPending, setPingPending] =
    useState(false);

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

  const previewGame = useMemo(() => {
    const settings = gameSettings(
      playerCount,
      piecesPerPlayer
    );

    return createGame(
      playerCount,
      settings
    );
  }, [playerCount, piecesPerPlayer]);

  const visibleGame = game ?? previewGame;
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

    const onConnect = () => {
      setConnected(true);
      setStatus('Server connected');
    };

    const onDisconnect = () => {
      setConnected(false);
      setStatus('Server disconnected');
    };

    const onError = () => {
      setConnected(false);
      setStatus('Unable to connect to server');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);

    socket.connect();

    return () => {
      mountedRef.current = false;
      clearTimer();

      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);

      socket.disconnect();
    };
  }, [setConnected, setStatus]);

  const startGame = () => {
    if (busyRef.current) return;

    clearTimer();

    const settings = gameSettings(
      playerCount,
      piecesPerPlayer
    );

    const next = createGame(
      playerCount,
      settings
    );

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

    try {
      const value = randomInt(6) + 1;

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

      if (
        next.ranking.length >=
        next.N - 1
      ) {
        const remaining = Array.from(
          { length: next.N },
          (_, seat) => seat
        ).filter(
          seat => !next.ranking.includes(seat)
        );

        const finalRanking = [
          ...next.ranking,
          ...remaining,
        ];

        setRanking(finalRanking);
        setPhase('FINISHED');

        log(
          `🏆 ${nameOf(finalRanking[0])} wins!`
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

  const homeCount = (seat: number) => {
    if (!game) return 0;

    return game.pieces.filter(
      piece =>
        piece.ownerSeat === seat &&
        piece.progress ===
        game.L + game.H
    ).length;
  };

  const ping = () => {
    if (
      !socket.connected ||
      pingPending
    ) {
      return;
    }

    setPingPending(true);

    socket.timeout(3000).emit(
      'app:ping',
      (error, response) => {
        if (!mountedRef.current) return;

        setPingPending(false);

        setStatus(
          error
            ? 'Ping timed out'
            : `PONG at ${new Date(
              response.at
            ).toLocaleTimeString()}`
        );
      }
    );
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

  return (
    <main className="min-h-screen bg-[#fff3db] px-3 py-5 text-[#223748] sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#ffb82e] p-3 text-[#213747] shadow">
              <Dice5 size={28} />
            </div>

            <div>
              <h1 className="text-3xl font-black">
                Ludo{' '}
                <span className="text-[#f53d62]">
                  Rush
                </span>
              </h1>

              <p className="text-xs text-[#69808d]">
                Phase 3.5C · 3D Miniature Arena
              </p>
            </div>
          </div>

          <span
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ${connected
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
              }`}
          >
            {connected ? (
              <Wifi size={15} />
            ) : (
              <WifiOff size={15} />
            )}

            {connected ? 'Online' : 'Offline'}
          </span>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_335px]">
          <section className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full border-2 border-white shadow"
                  style={{
                    backgroundColor: playerColor(
                      activeSeat,
                      visibleGame.N
                    ),
                  }}
                />

                <div>
                  <h2 className="text-lg font-black">
                    {phase === 'SETUP'
                      ? 'Explore the arena'
                      : phase === 'FINISHED'
                        ? 'Game complete'
                        : `${nameOf(activeSeat)}'s turn`}
                  </h2>

                  <p className="text-sm text-[#71828c]">
                    {instruction}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  aria-label="Zoom out"
                  onClick={() =>
                    boardRef.current?.zoomOut()
                  }
                  className="rounded-xl bg-[#edf4f3] p-2"
                >
                  <Minus size={18} />
                </button>

                <button
                  aria-label="Zoom in"
                  onClick={() =>
                    boardRef.current?.zoomIn()
                  }
                  className="rounded-xl bg-[#edf4f3] p-2"
                >
                  <Plus size={18} />
                </button>

                <button
                  aria-label="Reset camera"
                  onClick={() =>
                    boardRef.current?.resetView()
                  }
                  className="rounded-xl bg-[#edf4f3] p-2"
                >
                  <Focus size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border-4 border-white bg-white p-1 shadow-xl">
              <Board3D
                ref={boardRef}
                game={visibleGame}
                validPieceIds={legalIds}
                onPieceClick={choosePiece}
                showRoutes={showRoutes}
                viewSeat={viewSeat}
                starsPerSegment={
                  settingsRef.current?.starTilesPerSegment ??
                  1
                }
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#607987]">
              <p>
                {visibleGame.L} track tiles ·{' '}
                {visibleGame.N} players · Clockwise
              </p>

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

            {game && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-3">
                {Array.from(
                  { length: game.N },
                  (_, seat) => (
                    <div
                      key={seat}
                      className={`min-w-[120px] shrink-0 rounded-2xl border-2 p-3 ${seat === activeSeat &&
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

                        P{seat + 1}
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
          </section>

          <aside className="space-y-4">
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
                {Array.from(
                  { length: visibleGame.N },
                  (_, seat) => (
                    <option
                      key={seat}
                      value={seat}
                    >
                      Player {seat + 1}'s home
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
                <h2 className="text-xl font-black">
                  New game
                </h2>

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
                  across {visibleGame.N} players.
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

                <div className="my-5 flex justify-center">
                  <div className="flex h-28 w-28 items-center justify-center rounded-3xl border-4 border-amber-400 bg-[#26475a] text-6xl font-black text-white shadow-lg">
                    {dice ?? (
                      <Dice5 size={50} />
                    )}
                  </div>
                </div>

                {phase !== 'FINISHED' && (
                  <button
                    disabled={phase !== 'ROLL'}
                    onClick={rollDice}
                    className="w-full rounded-2xl bg-[#ffbd43] p-4 font-black text-[#263640] hover:bg-[#ffd06d] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {phase === 'ROLL'
                      ? '🎲 Roll dice'
                      : phase === 'CHOOSE'
                        ? 'Choose a glowing character'
                        : 'Please wait...'}
                  </button>
                )}

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

            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="mb-2 font-bold">
                Development connection
              </h2>

              <p className="mb-3 text-xs text-slate-500">
                {status}
              </p>

              <button
                disabled={
                  !connected ||
                  pingPending
                }
                onClick={ping}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm disabled:opacity-40"
              >
                {pingPending
                  ? 'Checking...'
                  : 'Test socket ping'}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
