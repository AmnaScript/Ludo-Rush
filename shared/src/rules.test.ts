
import {
    describe,
    expect,
    it,
} from 'vitest';

import {
    CAPTURE_LOCK_MS,
    applyMove,
    createBoardGeometry,
    createGame,
    createSettings,
    getSafeTiles,
    legalMoves,
    nextActiveSeat,
    pickCaptureStyle,
    resolveRoll,
    ringIndex,
    segmentSizeForPlayers,
    tileOf,
} from './index';

import type {
    GameState,
    GameSettings,
} from './index';

const alwaysFirst = () => 0;

function setup(
    N: number,
    overrides: Partial<GameSettings> = {}
) {
    const settings = createSettings(
        N,
        overrides
    );

    return {
        settings,
        game: createGame(N, settings),
    };
}

function withProgress(
    game: GameState,
    id: string,
    progress: number
): GameState {
    return {
        ...game,
        pieces: game.pieces.map(
            p =>
                p.id === id
                    ? { ...p, progress }
                    : p
        ),
    };
}

function rolled(
    game: GameState,
    dice: number
): GameState {
    return { ...game, dice };
}

for (const N of [2, 4, 9, 16]) {
    describe(`${N}-player board and rules`, () => {
        it('generates the correct ring, lanes, bases and safe tiles', () => {
            const S = segmentSizeForPlayers(N);
            const board = createBoardGeometry(N);

            expect(board.L).toBe(N * S);
            expect(board.ring).toHaveLength(N * S);
            expect(board.bases).toHaveLength(N);
            expect(board.lanes).toHaveLength(N);

            expect(
                board.lanes.every(
                    lane => lane.length === 5
                )
            ).toBe(true);

            expect(board.safeTiles).toHaveLength(
                N * 2
            );

            expect(
                new Set(board.safeTiles).size
            ).toBe(board.safeTiles.length);

            expect(
                board.ring.every(
                    tile =>
                        Number.isFinite(tile.x) &&
                        Number.isFinite(tile.y)
                )
            ).toBe(true);

            expect(
                board.radius
            ).toBeGreaterThanOrEqual(260);
        });

        it('uses correct ring wrapping and private lanes', () => {
            const { game } = setup(N);

            expect(
                ringIndex(
                    0,
                    game.L - 1,
                    N,
                    game.S
                )
            ).toBe(game.L - 1);

            expect(
                ringIndex(
                    1,
                    game.L - 1,
                    N,
                    game.S
                )
            ).toBe(game.S - 1);

            expect(
                tileOf(
                    1,
                    game.L,
                    N,
                    game.S,
                    game.H
                )
            ).toEqual({
                kind: 'lane',
                seat: 1,
                index: 0,
            });

            expect(
                tileOf(
                    1,
                    game.L + game.H,
                    N,
                    game.S,
                    game.H
                )
            ).toEqual({
                kind: 'finish',
                seat: 1,
            });
        });

        it('requires a six to leave base by default', () => {
            const { game, settings } = setup(N);

            expect(
                legalMoves(
                    game,
                    0,
                    4,
                    settings
                )
            ).toEqual([]);

            expect(
                legalMoves(
                    game,
                    0,
                    6,
                    settings
                )
            ).toHaveLength(
                settings.piecesPerPlayer
            );

            const moved = applyMove(
                rolled(game, 6),
                's0-p0',
                settings
            );

            expect(moved.to).toBe(0);

            expect(moved.path).toEqual([
                {
                    kind: 'ring',
                    index: 0,
                },
            ]);

            expect(
                game.pieces[0].progress
            ).toBe(-1);
        });

        it('rejects overshoot with exact roll and can clamp without it', () => {
            const { game, settings } = setup(N);

            const nearEnd = withProgress(
                game,
                's0-p0',
                game.L + game.H - 2
            );

            expect(
                legalMoves(
                    nearEnd,
                    0,
                    3,
                    settings
                )
            ).toEqual([]);

            const relaxed = {
                ...settings,
                exactFinishRoll: false,
            };

            expect(
                legalMoves(
                    nearEnd,
                    0,
                    3,
                    relaxed
                )
            ).toContain('s0-p0');

            expect(
                applyMove(
                    rolled(nearEnd, 3),
                    's0-p0',
                    relaxed
                ).to
            ).toBe(game.L + game.H);
        });

        it('lets a piece finish with the exact roll', () => {
            const { game, settings } = setup(
                N,
                { piecesPerPlayer: 1 }
            );

            const ready = withProgress(
                game,
                's0-p0',
                game.L + game.H - 2
            );

            const result = applyMove(
                rolled(ready, 2),
                's0-p0',
                settings
            );

            expect(result.pieceHome).toBe(true);
            expect(result.playerFinished).toBe(true);

            expect(result.game.ranking).toEqual([
                0,
            ]);

            expect(result.nextSeat).toBe(1);
        });

        it('cancels the third six, passing the turn', () => {
            const { game, settings } = setup(N);

            const result = resolveRoll(
                {
                    ...game,
                    consecutiveSixes: 2,
                },
                6,
                settings
            );

            expect(result.cancelled).toBe(true);
            expect(result.game.turnSeat).toBe(1);

            expect(
                result.game.consecutiveSixes
            ).toBe(0);

            expect(result.game.dice).toBeNull();
        });

        it('captures an unprotected opponent on a non-safe tile', () => {
            const { game, settings } = setup(
                N,
                { piecesPerPlayer: 2 }
            );

            const attacker = withProgress(
                game,
                's0-p0',
                1
            );

            const victimProgress =
                game.L - game.S + 2;

            const contested = withProgress(
                attacker,
                's1-p0',
                victimProgress
            );

            const result = applyMove(
                rolled(contested, 1),
                's0-p0',
                settings,
                alwaysFirst
            );

            expect(result.captures).toHaveLength(1);

            expect(
                result.captures[0]
            ).toMatchObject({
                victimId: 's1-p0',
                style: 'GUN',
                weapon: 'PISTOL',
                tile: 2,
            });

            expect(
                result.game.pieces.find(
                    p => p.id === 's1-p0'
                )?.progress
            ).toBe(-1);

            expect(
                contested.pieces.find(
                    p => p.id === 's1-p0'
                )?.progress
            ).toBe(victimProgress);
        });

        it('protects starts and stars from capture', () => {
            const { game, settings } = setup(
                N,
                { piecesPerPlayer: 1 }
            );

            const star = getSafeTiles(
                N,
                game.S
            ).find(
                t =>
                    t > 0 &&
                    t < game.S
            )!;

            const before = withProgress(
                game,
                's0-p0',
                star - 1
            );

            const victim = withProgress(
                before,
                's1-p0',
                game.L - game.S + star
            );

            const result = applyMove(
                rolled(victim, 1),
                's0-p0',
                settings,
                alwaysFirst
            );

            expect(result.captures).toHaveLength(0);

            expect(
                result.game.pieces.find(
                    p => p.id === 's1-p0'
                )?.progress
            ).not.toBe(-1);
        });

        it('protects a squad but captures both when squad protection is off', () => {
            const { game, settings } = setup(
                N,
                { piecesPerPlayer: 2 }
            );

            const base = withProgress(
                game,
                's0-p0',
                1
            );

            const contested = withProgress(
                withProgress(
                    base,
                    's1-p0',
                    game.L - game.S + 2
                ),
                's1-p1',
                game.L - game.S + 2
            );

            const defended = applyMove(
                rolled(contested, 1),
                's0-p0',
                settings,
                alwaysFirst
            );

            expect(
                defended.captures
            ).toHaveLength(0);

            const unprotected = applyMove(
                rolled(contested, 1),
                's0-p0',
                {
                    ...settings,
                    squadsProtected: false,
                },
                alwaysFirst
            );

            expect(
                unprotected.captures
            ).toHaveLength(2);

            expect(
                unprotected.game.pieces.filter(
                    p =>
                        p.ownerSeat === 1 &&
                        p.progress === -1
                )
            ).toHaveLength(2);
        });

        it('keeps the current player on an enabled extra turn', () => {
            const { game, settings } = setup(N);

            const result = applyMove(
                rolled(game, 6),
                's0-p0',
                settings
            );

            expect(result.extraTurn).toBe(true);
            expect(result.game.turnSeat).toBe(0);

            expect(
                result.game.consecutiveSixes
            ).toBe(0);
        });
    });
}

describe('additional configurable rules', () => {
    it('supports 1 or 6 and any-roll base entry modes', () => {
        const { game } = setup(4);

        expect(
            legalMoves(
                game,
                0,
                1,
                createSettings(
                    4,
                    { entryRule: 'ONE_OR_SIX' }
                )
            )
        ).toHaveLength(4);

        expect(
            legalMoves(
                game,
                0,
                3,
                createSettings(
                    4,
                    { entryRule: 'ANY' }
                )
            )
        ).toHaveLength(4);
    });

    it('weights capture styles deterministically and rejects all-disabled configuration', () => {
        expect(
            pickCaptureStyle(
                {
                    GUN: 0,
                    SLAP: 2,
                    DOG: 1,
                },
                () => 0
            )
        ).toBe('SLAP');

        expect(
            pickCaptureStyle(
                {
                    GUN: 0,
                    SLAP: 2,
                    DOG: 1,
                },
                () => 2
            )
        ).toBe('DOG');

        expect(
            () =>
                createSettings(4, {
                    captureStyles: {
                        GUN: 0,
                        SLAP: 0,
                        DOG: 0,
                    },
                })
        ).toThrow();

        expect(CAPTURE_LOCK_MS).toEqual({
            GUN: 1800,
            SLAP: 1700,
            DOG: 2600,
        });
    });

    it('records a rifle when a gun capture follows a roll of six', () => {
        const { game, settings } = setup(
            4,
            {
                captureStyles: {
                    GUN: 1,
                    SLAP: 0,
                    DOG: 0,
                },
            }
        );

        const contested = withProgress(
            withProgress(
                game,
                's0-p0',
                1
            ),
            's1-p0',
            game.L - game.S + 7
        );

        const result = applyMove(
            rolled(contested, 6),
            's0-p0',
            settings,
            alwaysFirst
        );

        expect(
            result.captures[0]?.weapon
        ).toBe('RIFLE');
    });

    it('skips finished seats and returns null when nobody is left', () => {
        const { game } = setup(
            2,
            { piecesPerPlayer: 1 }
        );

        const finished = withProgress(
            game,
            's1-p0',
            game.L + game.H
        );

        expect(
            nextActiveSeat(
                {
                    ...finished,
                    ranking: [1],
                },
                0
            )
        ).toBeNull();
    });

    it('quick preset uses one piece for 9+ players and shorter segments above ten', () => {
        expect(
            createSettings(9).piecesPerPlayer
        ).toBe(1);

        expect(
            createSettings(16).segmentSize
        ).toBe(6);
    });

    it('requires a roll before moving and rejects another player\'s piece', () => {
        const { game, settings } = setup(4);

        expect(
            () =>
                applyMove(
                    game,
                    's0-p0',
                    settings
                )
        ).toThrow('Roll first');

        expect(
            () =>
                applyMove(
                    rolled(game, 6),
                    's1-p0',
                    settings
                )
        ).toThrow('Illegal');
    });

    it('handles no legal move, passing the turn', () => {
        const { game, settings } = setup(4);

        const result = resolveRoll(
            game,
            3,
            settings
        );

        expect(
            result.validPieceIds
        ).toEqual([]);

        expect(
            result.game.turnSeat
        ).toBe(1);

        expect(
            result.game.dice
        ).toBeNull();
    });

    it('keeps six streak only across consecutive six rolls', () => {
        const { game, settings } = setup(4);

        const first = resolveRoll(
            game,
            6,
            settings
        );

        expect(
            first.game.consecutiveSixes
        ).toBe(1);

        const moved = applyMove(
            first.game,
            's0-p0',
            settings
        );

        const second = resolveRoll(
            moved.game,
            6,
            settings
        );

        expect(
            second.game.consecutiveSixes
        ).toBe(2);

        const cancelled = resolveRoll(
            {
                ...second.game,
                dice: null,
            },
            6,
            settings
        );

        expect(
            cancelled.cancelled
        ).toBe(true);
    });
});
