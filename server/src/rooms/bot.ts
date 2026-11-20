import { applyMove, type GameSettings, type GameState } from '@ludo-rush/shared';

/** Auto-play choice: capture > finish > leave base > furthest piece. */
export function chooseBotMove(
    game: GameState,
    settings: GameSettings,
    validPieceIds: string[]
): string {
    let best = validPieceIds[0]!;
    let bestScore = -Infinity;

    for (const id of validPieceIds) {
        // Evaluation only: a fixed picker keeps this deterministic and side-effect free.
        const result = applyMove(game, id, settings, () => 0);
        const score =
            result.captures.length * 1000 +
            (result.pieceHome ? 600 : 0) +
            (result.from === -1 ? 300 : 0) -
            (result.penalty ? 2000 : 0) +
            result.to;

        if (score > bestScore) {
            bestScore = score;
            best = id;
        }
    }

    return best;
}
