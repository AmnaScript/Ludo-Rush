import { describe, expect, it } from 'vitest';
import {
    applyMove,
    capturingMoves,
    createArenaGame,
    difficultyOverrides,
    legalMoves,
    resolveRoll,
} from './index';
import type { GameState } from './index';

function board(difficulty: 'EASY' | 'MEDIUM' | 'HARD', progress: Record<string, number>) {
    const { game, settings } = createArenaGame(2, 2, difficulty);
    const pieces = game.pieces.map(p => ({
        ...p,
        progress: progress[p.id] ?? p.progress,
    }));
    return { settings, game: { ...game, pieces } as GameState };
}

describe('difficulty', () => {
    it('maps each level to its rules', () => {
        expect(difficultyOverrides('EASY')).toMatchObject({ entryRule: 'ONE_OR_SIX', exactFinishRoll: false });
        expect(difficultyOverrides('MEDIUM')).toMatchObject({ entryRule: 'SIX', exactFinishRoll: true, missedCapturePenalty: false });
        expect(difficultyOverrides('HARD')).toMatchObject({ squadsProtected: false, missedCapturePenalty: true });
    });

    it('easy lets a 1 or a 6 leave base, medium only a 6', () => {
        const easy = createArenaGame(2, 1, 'EASY');
        const med = createArenaGame(2, 1, 'MEDIUM');
        expect(legalMoves(easy.game, 0, 1, easy.settings)).toHaveLength(1);
        expect(legalMoves(easy.game, 0, 3, easy.settings)).toHaveLength(0);
        expect(legalMoves(med.game, 0, 1, med.settings)).toHaveLength(0);
        expect(legalMoves(med.game, 0, 6, med.settings)).toHaveLength(1);
    });

    it('easy lets an overshooting roll finish, medium does not', () => {
        const done = (d: 'EASY' | 'MEDIUM') => {
            const { game, settings } = createArenaGame(2, 1, d);
            const g = { ...game, pieces: game.pieces.map(p => (p.ownerSeat === 0 ? { ...p, progress: game.L + game.H - 1 } : p)) };
            return legalMoves(g, 0, 4, settings).length;
        };
        expect(done('EASY')).toBe(1);
        expect(done('MEDIUM')).toBe(0);
    });

    it('hard: skipping a possible capture sends the capturing piece home', () => {
        // seat 0 (piece 0 at start, piece 1 further on) vs seat 2 piece standing on tile 1
        const { game, settings } = board('HARD', { 's0-p0': 0, 's0-p1': 20, 's2-p0': 2 * 13 + 0 });
        const victimProgress = (1 - 26 + 52) % 52; // seat 2 piece that sits on ring tile 1
        const g0 = { ...game, pieces: game.pieces.map(p => (p.id === 's2-p0' ? { ...p, progress: victimProgress } : p)) };
        const rolled = resolveRoll(g0, 1, settings);
        const state = rolled.game;
        expect(capturingMoves(state, settings)).toEqual(['s0-p0']);

        const skipped = applyMove(state, 's0-p1', settings, () => 0);
        expect(skipped.captures).toHaveLength(0);
        expect(skipped.penalty).toEqual({ pieceId: 's0-p0', from: 0 });
        expect(skipped.game.pieces.find(p => p.id === 's0-p0')!.progress).toBe(-1);

        const hit = applyMove(state, 's0-p0', settings, () => 0);
        expect(hit.captures).toHaveLength(1);
        expect(hit.penalty).toBeUndefined();
    });

    it('medium has no missed-capture penalty', () => {
        const { game, settings } = board('MEDIUM', { 's0-p0': 0, 's0-p1': 20 });
        const victimProgress = (1 - 26 + 52) % 52;
        const g0 = { ...game, pieces: game.pieces.map(p => (p.id === 's2-p0' ? { ...p, progress: victimProgress } : p)) };
        const state = resolveRoll(g0, 1, settings).game;
        expect(applyMove(state, 's0-p1', settings, () => 0).penalty).toBeUndefined();
    });
});
