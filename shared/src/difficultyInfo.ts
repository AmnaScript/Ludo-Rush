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
            'Roll a 6 to bring a character out of its base. One 6 brings out one character.',
            'You can reach home with any roll that is big enough (no exact number needed).',
            'Three sixes in a row are allowed.',
            'Start tiles and the starred stop on each side are safe: nobody can be captured there.',
            'Two of your characters on one tile cannot be captured.',
        ],
    },
    MEDIUM: {
        label: 'Medium',
        tagline: 'Classic Ludo rules',
        rules: [
            'Roll a 6 to bring a character out of its base. One 6 brings out one character.',
            'You need the exact number to step into home.',
            'Three sixes in a row cancel your turn.',
            'Start tiles and the starred stop on each side are safe: nobody can be captured there.',
            'Two of your characters on one tile cannot be captured.',
        ],
    },
    HARD: {
        label: 'Hard',
        tagline: 'No mercy',
        rules: [
            'If you can capture and you do not, your own capturing character goes back to base.',
            'Roll a 6 to leave base (one character per 6), and the exact number to finish.',
            'Start tiles and the starred stop on each side are safe: nobody can be captured there.',
            'Pairs on one tile are NOT protected.',
            'Three sixes in a row cancel your turn.',
        ],
    },
};
