
import {
    getSafeTiles,
    type BoardCell,
    type GameState,
    type Piece,
} from '@ludo-rush/shared';

export type Vec3 = [number, number, number];

export interface BoardLayout {
    mode: 'classic' | 'arena';
    ring: Vec3[];
    lanes: Vec3[][];
    bases: Vec3[];
    slots: Vec3[][];
    safe: Set<number>;
    tileSize: number;
    radius: number;
    extent: number;
}

export const CLASSIC_COLORS = [
    '#ff3659',
    '#328cff',
    '#ffd02f',
    '#19c96f',
];

export function playerColor(
    seat: number,
    count: number
): string {
    if (count === 4) {
        return CLASSIC_COLORS[seat];
    }

    return `hsl(${Math.round(
        (seat / count) * 360
    )}, 90%, 57%)`;
}

export function segmentForPlayers(count: number): number {
    if (count === 4) return 13;
    if (count <= 8) return 8;
    if (count <= 12) return 7;
    if (count <= 16) return 6;
    return 5;
}

const GRID_STEP = 0.92;

function grid(col: number, row: number): Vec3 {
    return [
        (col - 7) * GRID_STEP,
        0,
        (row - 7) * GRID_STEP,
    ];
}

/**
 * Closed, classic 52-square Ludo circuit.
 *
 * Reversing the original anti-clockwise path
 * and rotating it to the upper-right entry
 * makes progression clockwise.
 *
 * Starts: 0, 13, 26, 39.
 */
const OLD_TRACK: [number, number][] = [
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
    [5, 6], [4, 6], [3, 6], [2, 6], [1, 6],
    [0, 6], [0, 7], [0, 8],
    [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
    [6, 9], [6, 10], [6, 11], [6, 12],
    [6, 13], [6, 14], [7, 14], [8, 14],
    [8, 13], [8, 12], [8, 11], [8, 10],
    [8, 9], [9, 8], [10, 8], [11, 8],
    [12, 8], [13, 8], [14, 8], [14, 7],
    [14, 6], [13, 6], [12, 6], [11, 6],
    [10, 6], [9, 6], [8, 5], [8, 4],
    [8, 3], [8, 2], [8, 1], [8, 0],
    [7, 0], [6, 0],
];

const CLASSIC_TRACK = Array.from(
    { length: 52 },
    (_, i) => OLD_TRACK[(48 - i + 52) % 52]
);

function slotsAt(
    base: Vec3,
    spacing: number
): Vec3[] {
    return [
        [base[0] - spacing, 0, base[2] - spacing],
        [base[0] + spacing, 0, base[2] - spacing],
        [base[0] - spacing, 0, base[2] + spacing],
        [base[0] + spacing, 0, base[2] + spacing],
    ];
}

function createClassic(game: GameState): BoardLayout {
    const bases: Vec3[] = [
        grid(11.5, 2.5),
        grid(11.5, 11.5),
        grid(2.5, 11.5),
        grid(2.5, 2.5),
    ];

    const lanes: Vec3[][] = [
        Array.from({ length: 6 }, (_, i) =>
            grid(7, i + 1)
        ),
        Array.from({ length: 6 }, (_, i) =>
            grid(13 - i, 7)
        ),
        Array.from({ length: 6 }, (_, i) =>
            grid(7, 13 - i)
        ),
        Array.from({ length: 6 }, (_, i) =>
            grid(i + 1, 7)
        ),
    ];

    return {
        mode: 'classic',
        ring: CLASSIC_TRACK.map(([col, row]) =>
            grid(col, row)
        ),
        lanes,
        bases,
        slots: bases.map(base => slotsAt(base, 0.87)),
        safe: new Set(
            getSafeTiles(game.N, game.S)
        ),
        tileSize: 0.84,
        radius: 7,
        extent: 9.2,
    };
}

function createArena(
    game: GameState,
    starsPerSegment: number
): BoardLayout {
    const pitch =
        game.N <= 8
            ? 0.82
            : game.N <= 12
                ? 0.71
                : game.N <= 16
                    ? 0.64
                    : 0.59;

    const tileSize = pitch * 0.88;

    // Physical board radius grows slowly,
    // even if the number of tiles increases.
    const radius =
        (game.L * pitch) / (2 * Math.PI);

    const ring: Vec3[] = Array.from(
        { length: game.L },
        (_, index) => {
            // Increasing angle travels clockwise
            // when seen from the top of the board.
            const angle =
                -Math.PI / 2 +
                (index * 2 * Math.PI) / game.L;

            return [
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius,
            ];
        }
    );

    const bases: Vec3[] = [];
    const lanes: Vec3[][] = [];

    for (let seat = 0; seat < game.N; seat++) {
        const startAngle =
            -Math.PI / 2 +
            ((seat * game.S) * 2 * Math.PI) / game.L;

        const baseAngle =
            startAngle +
            (Math.PI * game.S) / game.L;

        const baseDistance = radius + 1.65;

        bases.push([
            Math.cos(baseAngle) * baseDistance,
            0,
            Math.sin(baseAngle) * baseDistance,
        ]);

        const entryAngle =
            -Math.PI / 2 +
            (((seat * game.S - 1 + game.L) % game.L) *
                2 *
                Math.PI) /
            game.L;

        const step = Math.min(
            pitch * 1.06,
            (radius - 1.5) / game.H
        );

        lanes.push(
            Array.from({ length: game.H }, (_, i) => {
                const distance =
                    radius - (i + 1) * step;

                return [
                    Math.cos(entryAngle) * distance,
                    0,
                    Math.sin(entryAngle) * distance,
                ] as Vec3;
            })
        );
    }

    return {
        mode: 'arena',
        ring,
        lanes,
        bases,
        slots: bases.map(base =>
            slotsAt(base, Math.min(0.38, pitch * 0.48))
        ),
        safe: new Set(
            getSafeTiles(
                game.N,
                game.S,
                starsPerSegment
            )
        ),
        tileSize,
        radius,
        extent: radius + 3.5,
    };
}

export function createLayout(
    game: GameState,
    starsPerSegment = 1
): BoardLayout {
    if (
        game.N === 4 &&
        game.S === 13 &&
        game.H === 6
    ) {
        return createClassic(game);
    }

    return createArena(game, starsPerSegment);
}

export function cellPosition(
    cell: BoardCell,
    layout: BoardLayout
): Vec3 {
    if (cell.kind === 'ring') {
        return layout.ring[cell.index];
    }

    if (cell.kind === 'lane') {
        return layout.lanes[cell.seat][cell.index];
    }

    if (cell.kind === 'base') {
        return layout.bases[cell.seat];
    }

    const angle =
        -Math.PI / 2 +
        (cell.seat * 2 * Math.PI) /
        layout.bases.length;

    return [
        Math.cos(angle) * 0.42,
        0,
        Math.sin(angle) * 0.42,
    ];
}

export function piecePosition(
    piece: Piece,
    game: GameState,
    layout: BoardLayout
): Vec3 {
    if (piece.progress === -1) {
        const pieceIndex = Number(
            piece.id.split('-p')[1] ?? 0
        );

        return layout.slots[
            piece.ownerSeat
        ][pieceIndex % 4];
    }

    if (piece.progress >= game.L + game.H) {
        return cellPosition(
            {
                kind: 'finish',
                seat: piece.ownerSeat,
            },
            layout
        );
    }

    if (piece.progress >= game.L) {
        return layout.lanes[
            piece.ownerSeat
        ][piece.progress - game.L];
    }

    return layout.ring[
        (piece.ownerSeat * game.S + piece.progress) %
        game.L
    ];
}

export function routeForPiece(
    piece: Piece,
    dice: number,
    game: GameState,
    layout: BoardLayout
): Vec3[] {
    const start =
        piece.progress < 0
            ? 0
            : piece.progress + 1;

    const end =
        piece.progress < 0
            ? 0
            : Math.min(
                game.L + game.H,
                piece.progress + dice
            );

    const result: Vec3[] = [];

    for (let progress = start; progress <= end; progress++) {
        if (progress < game.L) {
            result.push(
                layout.ring[
                (piece.ownerSeat * game.S + progress) %
                game.L
                ]
            );
        } else if (progress < game.L + game.H) {
            result.push(
                layout.lanes[
                piece.ownerSeat
                ][progress - game.L]
            );
        } else {
            result.push(
                cellPosition(
                    {
                        kind: 'finish',
                        seat: piece.ownerSeat,
                    },
                    layout
                )
            );
        }
    }

    return result;
}
