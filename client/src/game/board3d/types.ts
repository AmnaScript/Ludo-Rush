import * as THREE from 'three';
import { type MutableRefObject } from 'react';
import { type GameState, type MoveResult } from '@ludo-rush/shared';
import { type Vec3 } from '../boardLayout';

export interface Board3DHandle {
    resetView: () => void;
    playMove: (move: MoveResult) => Promise<void>;
}

export interface Props {
    game: GameState;
    validPieceIds: string[];
    onPieceClick: (id: string) => void;
    showRoutes: boolean;
    viewSeat: number;
    starsPerSegment?: number;
    /** Optional text above each home (nicknames online, P1/P2 locally). */
    seatLabels?: Record<number, string>;
}

export type Action =
    | 'idle'
    | 'walk'
    | 'run'
    | 'slap'
    | 'shoot'
    | 'panic'
    | 'fall'
    | 'celebrate';

export type CaptureStyle = 'SLAP' | 'DOG' | 'GUN';

export interface ActorData {
    root: THREE.Group;
    action: Action;
}

export interface MoveJob {
    move: MoveResult;
    resolve: () => void;
    stage: 'travel' | 'capture' | 'stepin' | 'penalty' | 'finish';
    penaltyDone?: boolean;
    index: number;
    time: number;
    from: Vec3;
    captureIndex: number;
    captureStarted: boolean;
    victimFrom: Vec3 | null;
    attackerFrom?: Vec3 | null;
    stagePos?: Vec3 | null;
    slapFrom?: Vec3 | null;
}

export interface FXState {
    style: CaptureStyle | 'PENALTY';
    label: string;
    /** Seconds the scene lasts (same clock as the animation). */
    duration: number;
    attackerSeat: number;
    victimSeat: number;
    attackerId: string;
    victimId: string;
    homePos: Vec3;
}

export type ActorRegistry = MutableRefObject<
    Map<string, ActorData>
>;


export type CameraActions = MutableRefObject<{
    resetView: () => void;
} | null>;
