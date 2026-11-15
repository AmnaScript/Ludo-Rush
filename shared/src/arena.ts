import type { GameSettings, GameState } from './gameTypes';
import { createGame, createSettings } from './rules';

/** Ring segment length per player count (shared by client layout and server). */
export function segmentForPlayers(count: number): number {
    if (count <= 4) return 13;
    if (count <= 8) return 8;
    if (count <= 12) return 7;
    if (count <= 16) return 6;
    return 5;
}

/**
 * Seats used for a given number of players.
 * 2 to 4 players use the classic cross board; 2 players sit opposite each
 * other and 3 players leave one corner empty. 5+ players use the ring arena.
 */
export function seatsForPlayers(count: number): number[] {
    if (count <= 1) return [0];
    if (count === 2) return [0, 2];
    if (count === 3) return [0, 1, 2];
    return Array.from({ length: count }, (_, seat) => seat);
}

/** The one place that decides the settings of a Ludo Rush game. */
export function arenaSettings(
    count: number,
    piecesPerPlayer: 1 | 2 | 3 | 4
): GameSettings {
    const engineSeats = Math.max(4, count);
    return createSettings(engineSeats, {
        piecesPerPlayer,
        segmentSize: segmentForPlayers(engineSeats),
        laneLength: 6,
        captureStyles: { SLAP: 1, DOG: 1, GUN: 1 },
    });
}

export interface ArenaGame {
    game: GameState;
    settings: GameSettings;
    /** Seat used by the i-th player. */
    seats: number[];
}

/** Creates a game for `count` players (empty corners simply have no pieces). */
export function createArenaGame(
    count: number,
    piecesPerPlayer: 1 | 2 | 3 | 4
): ArenaGame {
    const settings = arenaSettings(count, piecesPerPlayer);
    const seats = seatsForPlayers(count);
    const full = createGame(Math.max(4, count), settings);
    const game: GameState = {
        ...full,
        pieces: full.pieces.filter(p => seats.includes(p.ownerSeat)),
    };
    return { game, settings, seats };
}
