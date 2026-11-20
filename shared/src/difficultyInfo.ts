import type { Difficulty } from './gameTypes';

/** Plain-language rules shown in the UI for each difficulty. */
export const DIFFICULTY_INFO: Record<
    Difficulty,
    { label: string; tagline: string; rules: string[] }
> = {
    EASY: {
        label: 'Easy',
        tagline: 'Relaxed rules, good for beginners',
        rules: [
            'Roll a 1 or a 6 to bring a character out of its base.',
            'You can reach home with any roll that is big enough (no exact number needed).',
            'Three sixes in a row are allowed.',
            'Start tiles and two star tiles per side are safe.',
            'Two of your characters on one tile cannot be captured.',
        ],
    },
    MEDIUM: {
        label: 'Medium',
        tagline: 'Classic Ludo rules',
        rules: [
            'Roll a 6 to bring a character out of its base.',
            'You need the exact number to step into home.',
            'Three sixes in a row cancel your turn.',
            'Start tiles and one star tile per side are safe.',
            'Two of your characters on one tile cannot be captured.',
        ],
    },
    HARD: {
        label: 'Hard',
        tagline: 'No mercy',
        rules: [
            'If you can capture and you do not, your own capturing character goes back to base.',
            'Roll a 6 to leave base, and the exact number to finish.',
            'Only start tiles are safe, there are no star tiles.',
            'Pairs on one tile are NOT protected.',
            'Three sixes in a row cancel your turn.',
        ],
    },
};
