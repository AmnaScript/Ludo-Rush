
import type { CaptureStyle } from './gameTypes';

export const CAPTURE_LOCK_MS: Readonly<
    Record<CaptureStyle, number>
> = {
    GUN: 1800,
    SLAP: 1700,
    DOG: 2600,
};

export const CAPTURE_STYLES = [
    'GUN',
    'SLAP',
    'DOG',
] as const;

/**
 * Inject an integer picker in [0, maxExclusive)
 * so the rules remain pure.
 *
 * The server will supply crypto.randomInt;
 * tests supply fixed pickers.
 */
export type RandomInt = (
    maxExclusive: number
) => number;

export function pickCaptureStyle(
    weights: Readonly<Record<CaptureStyle, number>>,
    randomInt: RandomInt
): CaptureStyle {
    let total = 0;

    for (const style of CAPTURE_STYLES) {
        const weight = weights[style];

        if (
            !Number.isSafeInteger(weight) ||
            weight < 0
        ) {
            throw new Error(
                `Invalid capture weight for ${style}`
            );
        }

        total += weight;
    }

    if (
        !Number.isSafeInteger(total) ||
        total === 0
    ) {
        throw new Error(
            'At least one capture style must have a positive weight'
        );
    }

    const chosen = randomInt(total);

    if (
        !Number.isInteger(chosen) ||
        chosen < 0 ||
        chosen >= total
    ) {
        throw new Error(
            'randomInt must return an integer in [0, maxExclusive)'
        );
    }

    let cursor = 0;

    for (const style of CAPTURE_STYLES) {
        cursor += weights[style];

        if (chosen < cursor) {
            return style;
        }
    }

    throw new Error(
        'Unreachable random picker state'
    );
}
