
/** Pure rule-engine contracts. No network, timers or mutable singleton state. */

export type CaptureStyle = 'GUN' | 'SLAP' | 'DOG';
export type Weapon = 'PISTOL' | 'RIFLE';
export type EntryRule = 'SIX' | 'ONE_OR_SIX' | 'ANY';

export interface GameSettings {
    piecesPerPlayer: 1 | 2 | 3 | 4;
    segmentSize: number;
    laneLength: number;
    entryRule: EntryRule;
    extraTurnOnSix: boolean;
    extraTurnOnCapture: boolean;
    extraTurnOnFinish: boolean;
    threeSixesRule: boolean;
    squadsProtected: boolean;
    exactFinishRoll: boolean;
    starTilesPerSegment: number;
    captureStyles: Record<CaptureStyle, number>;
}

export interface Piece {
    id: string;
    ownerSeat: number;
    /** -1 base, 0..L-1 ring, L..L+H-1 home lane, L+H finished */
    progress: number;
}

export interface GameState {
    N: number;
    S: number;
    H: number;
    L: number;
    pieces: Piece[];
    turnSeat: number;
    dice: number | null;
    consecutiveSixes: number;
    /** Seats in order in which they finished all their pieces. */
    ranking: number[];
}

export interface RingCell {
    kind: 'ring';
    index: number;
}

export interface LaneCell {
    kind: 'lane';
    seat: number;
    index: number;
}

export interface BaseCell {
    kind: 'base';
    seat: number;
}

export interface FinishCell {
    kind: 'finish';
    seat: number;
}

export type BoardCell =
    | RingCell
    | LaneCell
    | BaseCell
    | FinishCell;

export interface Capture {
    attackerId: string;
    victimId: string;
    tile: number;
    style: CaptureStyle;
    weapon?: Weapon;
    lockMs: number;
}

export interface MoveResult {
    game: GameState;
    pieceId: string;
    from: number;
    to: number;
    /** Includes only traversed cells; leaving base -> [start tile]. */
    path: BoardCell[];
    run: boolean;
    captures: Capture[];
    pieceHome: boolean;
    playerFinished: boolean;
    extraTurn: boolean;
    nextSeat: number | null;
}

export interface RollResult {
    game: GameState;
    validPieceIds: string[];
    /** Third consecutive six is cancelled when enabled. */
    cancelled: boolean;
    nextSeat: number | null;
}
