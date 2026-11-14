import { randomInt } from 'node:crypto';
import { ROOM_LIMITS } from '@ludo-rush/shared';
import { Room, type LudoServer } from './Room';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
const MAX_ROOMS = 300;
const IDLE_MS = 10 * 60_000;

export class RoomManager {
    private rooms = new Map<string, Room>();
    private sweeper: NodeJS.Timeout;

    constructor(private readonly io: LudoServer) {
        this.sweeper = setInterval(() => this.sweep(), 60_000);
        this.sweeper.unref();
    }

    create(): Room | null {
        if (this.rooms.size >= MAX_ROOMS) return null;
        let code = '';
        do {
            code = Array.from(
                { length: ROOM_LIMITS.codeLength },
                () => ALPHABET[randomInt(ALPHABET.length)]!
            ).join('');
        } while (this.rooms.has(code));
        const room = new Room(code, this.io);
        this.rooms.set(code, room);
        return room;
    }

    get(code: unknown): Room | undefined {
        if (typeof code !== 'string') return undefined;
        return this.rooms.get(code.trim().toUpperCase());
    }

    size(): number {
        return this.rooms.size;
    }

    /** Drop rooms nobody is connected to for a while. */
    private sweep(): void {
        const now = Date.now();
        for (const [code, room] of this.rooms) {
            if (room.connectedHumans() === 0 && now - room.lastActive > IDLE_MS) {
                room.destroy();
                this.rooms.delete(code);
            }
        }
    }

    close(): void {
        clearInterval(this.sweeper);
        for (const room of this.rooms.values()) room.destroy();
        this.rooms.clear();
    }
}
