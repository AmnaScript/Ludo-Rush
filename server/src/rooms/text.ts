import { ROOM_LIMITS } from '@ludo-rush/shared';

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g;

export function cleanText(input: unknown, max: number): string {
    if (typeof input !== 'string') return '';
    return input.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function cleanChat(input: unknown): string {
    return cleanText(input, ROOM_LIMITS.maxChatLength);
}

export function cleanNickname(input: unknown, taken: string[], fallback: string): string {
    const base = cleanText(input, ROOM_LIMITS.maxNickname) || fallback;
    const lower = new Set(taken.map(name => name.toLowerCase()));
    if (!lower.has(base.toLowerCase())) return base;
    for (let n = 2; n < 100; n++) {
        const candidate = `${base.slice(0, ROOM_LIMITS.maxNickname - 3)} ${n}`;
        if (!lower.has(candidate.toLowerCase())) return candidate;
    }
    return `${base.slice(0, 10)}${Date.now() % 1000}`;
}
