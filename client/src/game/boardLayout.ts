
import {
    getSafeTiles,
    starGeometry,
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
    /** Four resting spots per seat for characters that reached home. */
    finish: Vec3[][];
    safe: Set<number>;
    tileSize: number;
    radius: number;
    extent: number;
    /** Rotation about Y for ring / lane tiles (star board arms). */
    ringRot?: number[];
    laneRot?: number[][];
    /** Star board platform: hub radius and one slab per arm. */
    star?: { hub: number; arms: { pos: Vec3; rot: number; length: number; width: number }[] };
}

export const CLASSIC_COLORS = [
    '#ff3659',
    '#328cff',
    '#ffd02f',
    '#19c96f',
];

/** Lightness cycles so neighbouring seats differ even when hues are close. */
const LIGHTNESS = [52, 64, 42];

export function playerColor(
    seat: number,
    count: number
): string {
    if (count <= CLASSIC_COLORS.length) {
        return CLASSIC_COLORS[seat]!;
    }

    // Golden-angle hues keep consecutive seats far apart on the colour wheel.
    const hue = Math.round((seat * 137.508) % 360);
    return `hsl(${hue}, 85%, ${LIGHTNESS[seat % LIGHTNESS.length]}%)`;
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

/** 2x2 cluster of finish spots at `distance` from the centre along `angle`. */
function finishCluster(
    angle: number,
    distance: number,
    spacing: number
): Vec3[] {
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const tx = -dz;
    const tz = dx;
    const out: Vec3[] = [];

    for (const along of [-1, 1]) {
        for (const across of [-1, 1]) {
            out.push([
                dx * (distance + along * spacing) + tx * across * spacing,
                0,
                dz * (distance + along * spacing) + tz * across * spacing,
            ]);
        }
    }

    return out;
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
        finish: lanes.map(lane =>
            finishCluster(
                Math.atan2(lane[0][2], lane[0][0]),
                0.82,
                0.2
            )
        ),
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
    const N = game.N;
    const p = GRID_STEP;
    const phi = (2 * Math.PI) / N;
    const { inner, column: c } = starGeometry(N);
    const tipR = (inner + c) * p;

    const armAngle = (arm: number) =>
        -Math.PI / 2 + (((arm % N) + N) % N) * phi;

    const armPoint = (arm: number, radial: number, lateral: number): Vec3 => {
        const a = armAngle(arm);
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        return [
            dx * radial - dz * lateral,
            0,
            dz * radial + dx * lateral,
        ];
    };

    const ring: Vec3[] = [];
    const ringRot: number[] = [];

    for (let seat = 0; seat < N; seat++) {
        for (let j = 0; j < game.S; j++) {
            let arm = seat;
            let radial: number;
            let lateral: number;

            if (j < c) {
                // inward along the right column of this seat's arm
                radial = (inner + (c - 1 - j)) * p;
                lateral = p;
            } else if (j < 2 * c) {
                // outward along the left column of the next arm
                arm = seat + 1;
                radial = (inner + (j - c)) * p;
                lateral = -p;
            } else {
                // across the tip of the next arm
                arm = seat + 1;
                radial = (inner + c) * p;
                lateral = (j - 2 * c - 1) * p;
            }

            ring.push(armPoint(arm, radial, lateral));
            ringRot.push(-armAngle(arm));
        }
    }

    const bases: Vec3[] = [];
    const lanes: Vec3[][] = [];
    const laneRot: number[][] = [];
    const finish: Vec3[][] = [];
    const compact = N > 8;

    for (let seat = 0; seat < N; seat++) {
        bases.push(armPoint(seat, tipR + 1.9, 0));

        lanes.push(
            Array.from({ length: game.H }, (_, i) =>
                armPoint(seat, tipR - (i + 1) * p, 0)
            )
        );
        laneRot.push(Array.from({ length: game.H }, () => -armAngle(seat)));

        const laneEnd = tipR - game.H * p;
        finish.push(
            finishCluster(
                armAngle(seat),
                Math.max(laneEnd - 1.0, 0.9),
                compact ? 0.14 : 0.2
            )
        );
    }

    const r0 = Math.max((inner - 0.7) * p, 0.5);
    const r1 = tipR + 0.62;
    const arms = Array.from({ length: N }, (_, arm) => ({
        pos: armPoint(arm, (r0 + r1) / 2, 0),
        rot: -armAngle(arm),
        length: r1 - r0,
        width: 2 * p + 0.9,
    }));

    return {
        mode: 'arena',
        star: { hub: inner * p + 0.35, arms },
        ring,
        ringRot,
        lanes,
        laneRot,
        bases,
        slots: bases.map(base =>
            slotsAt(base, compact ? 0.5 : 0.87)
        ),
        finish,
        safe: new Set(
            getSafeTiles(N, game.S, starsPerSegment)
        ),
        tileSize: 0.84,
        radius: tipR + 0.6,
        extent: tipR + 4.2,
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

    const spots = layout.finish[cell.seat];

    return [
        spots.reduce((sum, v) => sum + v[0], 0) / spots.length,
        0,
        spots.reduce((sum, v) => sum + v[2], 0) / spots.length,
    ];
}

function finishSlot(piece: Piece, layout: BoardLayout): Vec3 {
    const index = Number(piece.id.split('-p')[1] ?? 0);
    return layout.finish[piece.ownerSeat][index % 4];
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
        return finishSlot(piece, layout);
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
            result.push(finishSlot(piece, layout));
        }
    }

    return result;
}
