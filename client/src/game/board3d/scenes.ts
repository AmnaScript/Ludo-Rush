import { type CaptureStyle } from './types';

/** Shared timing (fractions of a scene) so the animation and the effects line up. */
export const SCENE = {
    SLAP: { seconds: 2.8, hit: 0.36, gap: 2.3, lunge: 1.25 },
    GUN: { seconds: 3.0, fire: 0.26, hit: 0.4, gap: 3.3 },
    DOG: { seconds: 3.8, whistle: 0.3, bite: 0.56, gap: 2.6 },
    PENALTY: { seconds: 2.4 },
} as const;

export function sceneSeconds(style: CaptureStyle, lockMs: number): number {
    if (style === 'DOG') return Math.max(SCENE.DOG.seconds, Math.min(lockMs / 1000, 4.4));
    return SCENE[style].seconds;
}

export const ramp = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
