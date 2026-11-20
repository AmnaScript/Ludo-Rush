import type { Difficulty, GameSettings, GameState } from './gameTypes';
import { createGame, createSettings, difficultyOverrides } from './rules';

/** Home-lane length used by every board. */
export const LANE_LENGTH = 6;

/**
 * Star board geometry (5+ players): every player owns an arm like the arms of
 * the classic cross. Distances are in tile pitches.
 * `inner` is how far from the centre the inner end of an arm sits so that the
 * right column of one arm touches the left column of the next one.
 */
export function starGeometry(count: number): { inner: number; column: number } {
    const half = Math.PI / count;
    const inner = (Math.cos(half) + 0.5) / Math.sin(half);
    // Long enough that the home lane never runs into the centre.
    const column = Math.max(2, Math.ceil(LANE_LENGTH + 2.0 - inner));
    return { inner, column };
}

/** Ring segment length per player count (shared by client layout and server). */
export function segmentForPlayers(count: number): number {
    if (count <= 4) return 13;
    // up one side of an arm, across the tip (3 tiles), down the next arm
    return 2 * starGeometry(count).column + 3;
}

/**
 * Seats used for a given number of players.
 * 2 to 4 players use the classic cross board; 2 players sit opposite each
 * other and 3 players leave one corner empty. 5+ players use a star board.
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
    piecesPerPlayer: 1 | 2 | 3 | 4,
    difficulty: Difficulty = 'MEDIUM'
): GameSettings {
    const engineSeats = Math.max(4, count);
    return createSettings(engineSeats, {
        piecesPerPlayer,
        segmentSize: segmentForPlayers(engineSeats),
        laneLength: LANE_LENGTH,
        captureStyles: { SLAP: 1, DOG: 1, GUN: 1 },
        ...difficultyOverrides(difficulty),
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
    piecesPerPlayer: 1 | 2 | 3 | 4,
    difficulty: Difficulty = 'MEDIUM'
): ArenaGame {
    const settings = arenaSettings(count, piecesPerPlayer, difficulty);
    const seats = seatsForPlayers(count);
    const full = createGame(Math.max(4, count), settings);
    const game: GameState = {
        ...full,
        pieces: full.pieces.filter(p => seats.includes(p.ownerSeat)),
    };
    return { game, settings, seats };
}
