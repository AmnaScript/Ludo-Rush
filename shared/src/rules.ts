
import {
    getSafeTiles,
    segmentSizeForPlayers,
    tileOf,
    validateDimensions,
} from './boardGeometry';

import {
    CAPTURE_LOCK_MS,
    pickCaptureStyle,
    type RandomInt,
} from './captureStyles';

import type {
    BoardCell,
    Capture,
    EntryRule,
    GameSettings,
    GameState,
    MoveResult,
    Piece,
    RollResult,
} from './gameTypes';

export const DEFAULT_SETTINGS: Readonly<GameSettings> = {
    piecesPerPlayer: 4,
    segmentSize: 8,
    laneLength: 5,
    entryRule: 'SIX',
    extraTurnOnSix: true,
    extraTurnOnCapture: true,
    extraTurnOnFinish: true,
    threeSixesRule: true,
    squadsProtected: true,
    exactFinishRoll: true,
    starTilesPerSegment: 1,
    captureStyles: {
        GUN: 1,
        SLAP: 1,
        DOG: 1,
    },
};

export function createSettings(
    N: number,
    overrides: Partial<GameSettings> = {}
): GameSettings {
    const quick = N > 8;

    const settings: GameSettings = {
        ...DEFAULT_SETTINGS,
        piecesPerPlayer: quick ? 1 : 4,
        segmentSize: segmentSizeForPlayers(N),
        ...overrides,
        captureStyles: {
            ...DEFAULT_SETTINGS.captureStyles,
            ...overrides.captureStyles,
        },
    };

    validateSettings(N, settings);

    return settings;
}

export function validateSettings(
    N: number,
    settings: GameSettings
): void {
    validateDimensions(
        N,
        settings.segmentSize,
        settings.laneLength
    );

    if (
        ![1, 2, 3, 4].includes(settings.piecesPerPlayer)
    ) {
        throw new Error(
            'piecesPerPlayer must be 1..4'
        );
    }

    if (
        !['SIX', 'ONE_OR_SIX', 'ANY'].includes(
            settings.entryRule
        )
    ) {
        throw new Error('Invalid entry rule');
    }

    getSafeTiles(
        N,
        settings.segmentSize,
        settings.starTilesPerSegment
    );

    const weights = Object.values(
        settings.captureStyles
    );

    if (
        weights.length !== 3 ||
        !weights.every(
            w => Number.isSafeInteger(w) && w >= 0
        ) ||
        weights.reduce(
            (sum, w) => sum + w, 0
        ) === 0
    ) {
        throw new Error(
            'At least one capture style needs a positive integer weight'
        );
    }
}

export function createGame(
    N: number,
    settings = createSettings(N)
): GameState {
    validateSettings(N, settings);

    const pieces: Piece[] = Array.from(
        { length: N },
        (_, seat) =>
            Array.from(
                { length: settings.piecesPerPlayer },
                (_, index) => ({
                    id: `s${seat}-p${index}`,
                    ownerSeat: seat,
                    progress: -1,
                })
            )
    ).flat();

    return {
        N,
        S: settings.segmentSize,
        H: settings.laneLength,
        L: N * settings.segmentSize,
        pieces,
        turnSeat: 0,
        dice: null,
        consecutiveSixes: 0,
        ranking: [],
    };
}

export function canLeaveBase(
    dice: number,
    rule: EntryRule
): boolean {
    if (rule === 'ANY') {
        return true;
    }

    if (rule === 'ONE_OR_SIX') {
        return dice === 1 || dice === 6;
    }

    return dice === 6;
}

export function targetProgress(
    game: GameState,
    piece: Piece,
    dice: number,
    settings: GameSettings
): number | null {
    if (
        piece.progress === game.L + game.H
    ) {
        return null;
    }

    if (piece.progress === -1) {
        return canLeaveBase(
            dice,
            settings.entryRule
        ) ? 0 : null;
    }

    const target = piece.progress + dice;

    if (target > game.L + game.H) {
        return settings.exactFinishRoll
            ? null
            : game.L + game.H;
    }

    return target;
}

export function legalMoves(
    game: GameState,
    seat: number,
    dice: number,
    settings: GameSettings
): string[] {
    if (
        !Number.isSafeInteger(seat) ||
        seat < 0 ||
        seat >= game.N
    ) {
        throw new Error('Invalid seat');
    }

    if (
        !Number.isInteger(dice) ||
        dice < 1 ||
        dice > 6
    ) {
        throw new Error('Dice must be 1..6');
    }

    assertGameSettings(game, settings);

    // Same-seat stacking is legal.
    // Squads defend against capture, not movement.
    return game.pieces
        .filter(
            piece =>
                piece.ownerSeat === seat &&
                targetProgress(
                    game,
                    piece,
                    dice,
                    settings
                ) !== null
        )
        .map(piece => piece.id);
}

function assertGameSettings(
    game: GameState,
    settings: GameSettings
): void {
    if (
        game.L !== game.N * game.S ||
        settings.segmentSize !== game.S ||
        settings.laneLength !== game.H
    ) {
        throw new Error(
            'Settings and game board dimensions do not match'
        );
    }
}

export function nextActiveSeat(
    game: GameState,
    afterSeat: number
): number | null {
    for (
        let offset = 1;
        offset <= game.N;
        offset++
    ) {
        const seat =
            (afterSeat + offset) % game.N;

        if (seat === afterSeat) {
            continue;
        }

        if (
            !game.ranking.includes(seat) &&
            game.pieces.some(
                piece =>
                    piece.ownerSeat === seat &&
                    piece.progress !== game.L + game.H
            )
        ) {
            return seat;
        }
    }

    return null;
}

/**
 * The server supplies an authoritative dice value.
 * This pure function handles its rule consequences.
 */
export function resolveRoll(
    game: GameState,
    dice: number,
    settings: GameSettings
): RollResult {
    if (game.dice !== null) {
        throw new Error(
            'Roll already pending; finish or pass it first'
        );
    }

    if (
        !Number.isInteger(dice) ||
        dice < 1 ||
        dice > 6
    ) {
        throw new Error('Dice must be 1..6');
    }

    assertGameSettings(game, settings);

    if (game.ranking.includes(game.turnSeat)) {
        throw new Error(
            'Finished player cannot roll'
        );
    }

    const sixes =
        dice === 6
            ? game.consecutiveSixes + 1
            : 0;

    if (
        dice === 6 &&
        settings.threeSixesRule &&
        sixes >= 3
    ) {
        const nextSeat = nextActiveSeat(
            game,
            game.turnSeat
        );

        return {
            game: {
                ...game,
                dice: null,
                consecutiveSixes: 0,
                turnSeat:
                    nextSeat ?? game.turnSeat,
            },
            validPieceIds: [],
            cancelled: true,
            nextSeat,
        };
    }

    const validPieceIds = legalMoves(
        game,
        game.turnSeat,
        dice,
        settings
    );

    if (validPieceIds.length === 0) {
        const extraTurn =
            dice === 6 &&
            settings.extraTurnOnSix;

        const nextSeat = extraTurn
            ? game.turnSeat
            : nextActiveSeat(
                game,
                game.turnSeat
            );

        return {
            game: {
                ...game,
                dice: null,
                consecutiveSixes: extraTurn
                    ? sixes
                    : 0,
                turnSeat:
                    nextSeat ?? game.turnSeat,
            },
            validPieceIds,
            cancelled: false,
            nextSeat,
        };
    }

    return {
        game: {
            ...game,
            dice,
            consecutiveSixes: sixes,
        },
        validPieceIds,
        cancelled: false,
        nextSeat: game.turnSeat,
    };
}

/**
 * Apply a validated move without mutating input.
 * Call only after resolveRoll.
 */
export function applyMove(
    game: GameState,
    pieceId: string,
    settings: GameSettings,
    randomInt: RandomInt = () => {
        throw new Error(
            'Capture requires server randomInt'
        );
    }
): MoveResult {
    assertGameSettings(game, settings);

    if (game.dice === null) {
        throw new Error('Roll first');
    }

    const dice = game.dice;

    if (
        !legalMoves(
            game,
            game.turnSeat,
            dice,
            settings
        ).includes(pieceId)
    ) {
        throw new Error(
            'Illegal move for current player'
        );
    }

    const piece = game.pieces.find(
        p => p.id === pieceId
    )!;

    const from = piece.progress;

    const to = targetProgress(
        game,
        piece,
        dice,
        settings
    )!;

    const path: BoardCell[] =
        from === -1
            ? [
                tileOf(
                    piece.ownerSeat,
                    0,
                    game.N,
                    game.S,
                    game.H
                ),
            ]
            : Array.from(
                { length: to - from },
                (_, index) =>
                    tileOf(
                        piece.ownerSeat,
                        from + index + 1,
                        game.N,
                        game.S,
                        game.H
                    )
            );

    const pieces: Piece[] = game.pieces.map(
        p => ({
            ...p,
            progress:
                p.id === pieceId
                    ? to
                    : p.progress,
        })
    );

    const captures: Capture[] = [];

    if (to < game.L) {
        const destination = tileOf(
            piece.ownerSeat,
            to,
            game.N,
            game.S,
            game.H
        );

        if (destination.kind !== 'ring') {
            throw new Error(
                'Expected ring cell'
            );
        }

        const tile = destination.index;

        const safe = new Set(
            getSafeTiles(
                game.N,
                game.S,
                settings.starTilesPerSegment
            )
        );

        if (!safe.has(tile)) {
            const victims = pieces.filter(
                p =>
                    p.ownerSeat !== piece.ownerSeat &&
                    p.progress >= 0 &&
                    p.progress < game.L &&
                    tileOf(
                        p.ownerSeat,
                        p.progress,
                        game.N,
                        game.S,
                        game.H
                    ).kind === 'ring' &&
                    (
                        p.ownerSeat * game.S +
                        p.progress
                    ) % game.L === tile
            );

            const victimCounts =
                new Map<number, number>();

            for (const victim of victims) {
                victimCounts.set(
                    victim.ownerSeat,
                    (
                        victimCounts.get(
                            victim.ownerSeat
                        ) ?? 0
                    ) + 1
                );
            }

            for (const victim of victims) {
                if (
                    settings.squadsProtected &&
                    (
                        victimCounts.get(
                            victim.ownerSeat
                        ) ?? 0
                    ) >= 2
                ) {
                    continue;
                }

                const style = pickCaptureStyle(
                    settings.captureStyles,
                    randomInt
                );

                victim.progress = -1;

                captures.push({
                    attackerId: pieceId,
                    victimId: victim.id,
                    tile,
                    style,
                    ...(style === 'GUN'
                        ? {
                            weapon:
                                dice === 6
                                    ? 'RIFLE' as const
                                    : 'PISTOL' as const,
                        }
                        : {}),
                    lockMs: CAPTURE_LOCK_MS[style],
                });
            }
        }
    }

    const pieceHome =
        to === game.L + game.H;

    const playerFinished =
        pieceHome &&
        pieces
            .filter(
                p =>
                    p.ownerSeat ===
                    piece.ownerSeat
            )
            .every(
                p =>
                    p.progress ===
                    game.L + game.H
            );

    const ranking =
        playerFinished &&
            !game.ranking.includes(
                piece.ownerSeat
            )
            ? [
                ...game.ranking,
                piece.ownerSeat,
            ]
            : [...game.ranking];

    const extraTurn =
        !playerFinished &&
        (
            (
                dice === 6 &&
                settings.extraTurnOnSix
            ) ||
            (
                captures.length > 0 &&
                settings.extraTurnOnCapture
            ) ||
            (
                pieceHome &&
                settings.extraTurnOnFinish
            )
        );

    const provisional: GameState = {
        ...game,
        pieces,
        ranking,
        dice: null,
    };

    const nextSeat = extraTurn
        ? game.turnSeat
        : nextActiveSeat(
            provisional,
            game.turnSeat
        );

    return {
        game: {
            ...provisional,
            turnSeat:
                nextSeat ?? game.turnSeat,
            consecutiveSixes:
                extraTurn && dice === 6
                    ? game.consecutiveSixes
                    : 0,
        },
        pieceId,
        from,
        to,
        path,
        run: dice >= 4,
        captures,
        pieceHome,
        playerFinished,
        extraTurn,
        nextSeat,
    };
}
