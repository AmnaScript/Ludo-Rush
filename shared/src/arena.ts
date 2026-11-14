import type { GameSettings } from './gameTypes';
import { createSettings } from './rules';

/** Ring segment length per player count (shared by client layout and server). */
export function segmentForPlayers(count: number): number {
    if (count === 4) return 13;
    if (count <= 8) return 8;
    if (count <= 12) return 7;
    if (count <= 16) return 6;
    return 5;
}

/** The one place that decides the settings of a Ludo Rush game. */
export function arenaSettings(
    count: number,
    piecesPerPlayer: 1 | 2 | 3 | 4
): GameSettings {
    return createSettings(count, {
        piecesPerPlayer,
        segmentSize: segmentForPlayers(count),
        laneLength: 6,
        captureStyles: { SLAP: 1, DOG: 1, GUN: 1 },
    });
}
