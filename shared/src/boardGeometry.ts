
import type { BoardCell, GameState } from './gameTypes';

export const TILE_SIZE = 44;
export const MIN_RING_RADIUS = 260;
export const BASE_OFFSET = 140;

export interface Point {
    x: number;
    y: number;
}

export interface PositionedCell extends Point {
    cell: BoardCell;
}

export interface BasePosition extends Point {
    seat: number;
    pieces: Point[];
}

export interface BoardGeometry {
    N: number;
    S: number;
    H: number;
    L: number;
    radius: number;
    center: Point;
    ring: PositionedCell[];
    lanes: PositionedCell[][];
    bases: BasePosition[];
    finish: Point;
    safeTiles: number[];
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
}

export function validateDimensions(
    N: number,
    S: number,
    H: number
): void {
    if (
        ![N, S, H].every(Number.isSafeInteger) ||
        N < 2 ||
        S < 2 ||
        H < 1
    ) {
        throw new Error('Expected integers N>=2, S>=2, H>=1');
    }

    if (N * S > 4096) {
        throw new Error('Board too large');
    }
}

export function segmentSizeForPlayers(N: number): number {
    if (!Number.isSafeInteger(N) || N < 2) {
        throw new Error('N must be >= 2');
    }

    return N > 10 ? 6 : 8;
}

export function startTile(
    seat: number,
    S: number,
    N: number
): number {
    validateDimensions(N, S, 1);

    if (
        !Number.isSafeInteger(seat) ||
        seat < 0 ||
        seat >= N
    ) {
        throw new Error('Invalid seat');
    }

    return seat * S;
}

export function ringIndex(
    seat: number,
    progress: number,
    N: number,
    S: number
): number {
    validateDimensions(N, S, 1);

    if (
        !Number.isSafeInteger(progress) ||
        progress < 0 ||
        progress >= N * S
    ) {
        throw new Error('Progress is outside the ring');
    }

    return (startTile(seat, S, N) + progress) % (N * S);
}

export function tileOf(
    seat: number,
    progress: number,
    N: number,
    S: number,
    H: number
): BoardCell {
    validateDimensions(N, S, H);
    startTile(seat, S, N);

    const L = N * S;

    if (
        !Number.isSafeInteger(progress) ||
        progress < -1 ||
        progress > L + H
    ) {
        throw new Error('Invalid piece progress');
    }

    if (progress === -1) {
        return { kind: 'base', seat };
    }

    if (progress < L) {
        return {
            kind: 'ring',
            index: ringIndex(seat, progress, N, S),
        };
    }

    if (progress < L + H) {
        return {
            kind: 'lane',
            seat,
            index: progress - L,
        };
    }

    return { kind: 'finish', seat };
}

/** Start tile of every seat and configurable, distinct stars per segment. */
export function getSafeTiles(
    N: number,
    S: number,
    starsPerSegment = 1
): number[] {
    validateDimensions(N, S, 1);

    if (
        !Number.isSafeInteger(starsPerSegment) ||
        starsPerSegment < 0 ||
        starsPerSegment >= S
    ) {
        throw new Error('Invalid starsPerSegment');
    }

    const tiles = new Set<number>();

    for (let seat = 0; seat < N; seat++) {
        const start = seat * S;
        tiles.add(start);

        for (let star = 1; star <= starsPerSegment; star++) {
            const offset = Math.floor(
                (star * S) / (starsPerSegment + 1)
            );

            tiles.add(start + offset);
        }
    }

    return [...tiles].sort((a, b) => a - b);
}

export function seatColor(
    seat: number,
    N: number
): string {
    validateDimensions(N, 2, 1);

    if (
        !Number.isInteger(seat) ||
        seat < 0 ||
        seat >= N
    ) {
        throw new Error('Invalid seat');
    }

    return `hsl(${(360 * seat) / N} 75% 48%)`;
}

/** Coordinates are calculated, never hand-drawn; same data works in Phaser. */
export function createBoardGeometry(
    N: number,
    S = segmentSizeForPlayers(N),
    H = 5,
    starsPerSegment = 1
): BoardGeometry {
    validateDimensions(N, S, H);

    const L = N * S;

    const radius = Math.max(
        (L * TILE_SIZE) / (2 * Math.PI),
        MIN_RING_RADIUS
    );

    const center = { x: 0, y: 0 };

    const angleAt = (k: number) =>
        (2 * Math.PI * k) / L - Math.PI / 2;

    const at = (
        angle: number,
        distance: number
    ): Point => ({
        x: center.x + distance * Math.cos(angle),
        y: center.y + distance * Math.sin(angle),
    });

    const ring: PositionedCell[] = Array.from(
        { length: L },
        (_, index) => ({
            ...at(angleAt(index), radius),
            cell: {
                kind: 'ring',
                index,
            },
        })
    );

    const lanes: PositionedCell[][] = Array.from(
        { length: N },
        (_, seat) => {
            const entryAngle = angleAt(
                (startTile(seat, S, N) - 1 + L) % L
            );

            return Array.from(
                { length: H },
                (_, index) => ({
                    ...at(
                        entryAngle,
                        Math.max(
                            0,
                            radius - TILE_SIZE * (index + 1)
                        )
                    ),
                    cell: {
                        kind: 'lane',
                        seat,
                        index,
                    },
                })
            );
        }
    );

    const bases: BasePosition[] = Array.from(
        { length: N },
        (_, seat) => {
            const angle = angleAt(
                seat * S + S / 2
            );

            const position = at(
                angle,
                radius + BASE_OFFSET
            );

            const half = TILE_SIZE / 3;

            return {
                seat,
                ...position,
                pieces: [
                    {
                        x: position.x - half,
                        y: position.y - half,
                    },
                    {
                        x: position.x + half,
                        y: position.y - half,
                    },
                    {
                        x: position.x - half,
                        y: position.y + half,
                    },
                    {
                        x: position.x + half,
                        y: position.y + half,
                    },
                ],
            };
        }
    );

    const extent =
        radius + BASE_OFFSET + TILE_SIZE;

    return {
        N,
        S,
        H,
        L,
        radius,
        center,
        ring,
        lanes,
        bases,
        finish: center,
        safeTiles: getSafeTiles(
            N,
            S,
            starsPerSegment
        ),
        bounds: {
            minX: -extent,
            minY: -extent,
            maxX: extent,
            maxY: extent,
        },
    };
}

export function tileOfPiece(
    game: Pick<GameState, 'N' | 'S' | 'H'>,
    seat: number,
    progress: number
): BoardCell {
    return tileOf(
        seat,
        progress,
        game.N,
        game.S,
        game.H
    );
}
