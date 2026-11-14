/** Wire contract shared by server and client (rooms, lobby, game sync, chat). */
import type { GameState, MoveResult } from './gameTypes';

export type RoomPhase = 'LOBBY' | 'PLAYING' | 'FINISHED';

export interface RoomOptions {
    piecesPerPlayer: 1 | 2 | 4;
    /** Seconds a player has to roll and to move before auto-play kicks in. */
    turnSeconds: number;
}

export const DEFAULT_ROOM_OPTIONS: Readonly<RoomOptions> = {
    piecesPerPlayer: 4,
    turnSeconds: 20,
};

export const ROOM_LIMITS = {
    /** Soft cap that protects the server; there is no rule-level player limit. */
    maxPlayers: 32,
    minPlayersToStart: 2,
    maxChatLength: 200,
    chatHistory: 100,
    maxNickname: 16,
    codeLength: 6,
    minTurnSeconds: 8,
    maxTurnSeconds: 60,
} as const;

export interface PublicPlayer {
    id: string;
    nickname: string;
    /** null until the game starts. */
    seat: number | null;
    connected: boolean;
    isBot: boolean;
    isHost: boolean;
}

export interface ChatMessage {
    id: string;
    type: 'user' | 'system';
    nickname?: string;
    seat?: number | null;
    text: string;
    ts: number;
}

export interface TurnInfo {
    seat: number;
    /** Epoch ms when auto-play kicks in; null while a scene is playing. */
    deadline: number | null;
    dice: number | null;
    validPieceIds: string[];
}

export interface RoomSnapshot {
    code: string;
    phase: RoomPhase;
    options: RoomOptions;
    hostId: string;
    players: PublicPlayer[];
    spectators: number;
    game: GameState | null;
    turn: TurnInfo | null;
    chat: ChatMessage[];
}

export type JoinAck =
    | {
        ok: true;
        code: string;
        playerId: string;
        rejoinToken: string;
        spectator: boolean;
    }
    | { ok: false; error: string };

export interface PingResponse {
    message: 'pong';
    at: string;
}

export interface ClientToServerEvents {
    'app:ping': (ack: (response: PingResponse) => void) => void;
    'room:create': (
        payload: { nickname: string; options?: Partial<RoomOptions> },
        ack: (result: JoinAck) => void
    ) => void;
    'room:join': (
        payload: {
            code: string;
            nickname: string;
            rejoinToken?: string;
            /** True for automatic reconnects: fail instead of joining as a new player. */
            rejoinOnly?: boolean;
        },
        ack: (result: JoinAck) => void
    ) => void;
    'room:leave': () => void;
    'room:options': (options: Partial<RoomOptions>) => void;
    'game:start': () => void;
    'game:roll': () => void;
    'game:move': (payload: { pieceId: string }) => void;
    'game:rematch': () => void;
    'chat:send': (payload: { text: string }) => void;
}

export interface RolledPayload {
    seat: number;
    value: number;
    validPieceIds: string[];
    cancelled: boolean;
    nextSeat: number | null;
    game: GameState;
}

export interface MovedPayload {
    move: MoveResult;
    /** Server waits at least this long before the next game:turn. */
    lockMs: number;
}

export interface ServerToClientEvents {
    'app:connected': (payload: { message: string }) => void;
    'room:state': (snapshot: RoomSnapshot) => void;
    'chat:message': (message: ChatMessage) => void;
    'game:rolled': (payload: RolledPayload) => void;
    'game:moved': (payload: MovedPayload) => void;
    'game:turn': (turn: TurnInfo) => void;
    'game:ended': (payload: { ranking: number[] }) => void;
    'error:msg': (payload: { message: string }) => void;
}
