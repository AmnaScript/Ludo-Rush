/**
 * Load test: N fake clients join one room and play a full game over real sockets.
 * Run the server with LUDO_TIMING_SCALE=0.02 PORT=5055, then:
 *   PLAYERS=16 SERVER=http://localhost:5055 npx tsx test/simulate.ts
 */
import { io, type Socket } from 'socket.io-client';
import type {
    ClientToServerEvents,
    JoinAck,
    RoomSnapshot,
    ServerToClientEvents,
} from '@ludo-rush/shared';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER = process.env.SERVER ?? 'http://localhost:5055';
const PLAYERS = Number(process.env.PLAYERS ?? 16);
const started = Date.now();
const fail = (msg: string): never => {
    console.error('FAIL:', msg);
    process.exit(1);
};

function connect(): Promise<Client> {
    return new Promise((resolve, reject) => {
        const s: Client = io(SERVER, { transports: ['websocket'], forceNew: true });
        s.once('connect', () => resolve(s));
        s.once('connect_error', reject);
    });
}

const ackOf = (s: Client, event: 'room:create' | 'room:join', payload: never) =>
    new Promise<JoinAck>(resolve => {
        (s.emit as (...a: unknown[]) => void)(event, payload, resolve);
    });

async function main() {
    const clients: Client[] = [];
    const info: { playerId: string; token: string; seat: number | null }[] = [];
    let snapshot: RoomSnapshot | null = null;
    let chats = 0;
    let moves = 0;
    let captures = 0;
    const errors: string[] = [];

    const host = await connect();
    const created = await ackOf(host, 'room:create', { nickname: 'Host', options: { piecesPerPlayer: 1, turnSeconds: 8 } } as never);
    if (!created.ok) return fail(created.error);
    const code = created.code;
    clients.push(host);
    info.push({ playerId: created.playerId, token: created.rejoinToken, seat: null });

    for (let i = 1; i < PLAYERS; i++) {
        const c = await connect();
        const ack = await ackOf(c, 'room:join', { code, nickname: `P${i}` } as never);
        if (!ack.ok) return fail(ack.error);
        clients.push(c);
        info.push({ playerId: ack.playerId, token: ack.rejoinToken, seat: null });
    }

    const ended = new Promise<number[]>(resolve => {
        clients.forEach((c, idx) => {
            wire(c, idx);
            if (idx === 0) c.on('game:ended', ({ ranking }) => resolve(ranking));
        });
    });

    function wire(c: Client, idx: number) {
        c.on('room:state', s => {
            if (idx === 0) snapshot = s;
            const mine = s.players.find(p => p.id === info[idx]!.playerId);
            if (mine) info[idx]!.seat = mine.seat;
        });
        c.on('chat:message', () => { if (idx === 0) chats++; });
        c.on('error:msg', e => errors.push(e.message));
        c.on('game:turn', turn => {
            if (turn.seat === info[idx]!.seat && turn.dice === null) c.emit('game:roll');
        });
        c.on('game:rolled', r => {
            if (r.seat === info[idx]!.seat && r.validPieceIds.length > 1) {
                c.emit('game:move', { pieceId: r.validPieceIds[Math.floor(Math.random() * r.validPieceIds.length)]! });
            }
        });
        c.on('game:moved', m => { if (idx === 0) { moves++; captures += m.move.captures.length; } });
    }

    await new Promise(r => setTimeout(r, 300));
    const snap0 = snapshot as RoomSnapshot | null;
    if (!snap0 || snap0.players.length !== PLAYERS) return fail(`lobby shows ${snap0?.players.length} players, expected ${PLAYERS}`);
    clients[1]!.emit('game:start');
    await new Promise(r => setTimeout(r, 200));
    if (errors.length === 0 || !errors[0]!.includes('host')) return fail(`non-host start was not rejected: ${errors.join('|')}`);
    errors.length = 0;

    clients[1]!.emit('chat:send', { text: '<img src=x onerror=alert(1)>   hi' });
    host.emit('game:start');

    // Reconnect test: client 3 drops mid-game, then rejoins with its token.
    if (clients.length > 3) setTimeout(async () => {
        clients[3]?.disconnect();
        await new Promise(r => setTimeout(r, 400));
        const back = await connect();
        const ack = await ackOf(back, 'room:join', { code, nickname: 'ignored', rejoinToken: info[3]!.token } as never);
        if (!ack.ok || ack.playerId !== info[3]!.playerId) return fail('rejoin did not restore the same player');
        clients[3] = back;
        wire(back, 3);
        console.log('reconnect ok');
    }, 1500);

    const timeout = setTimeout(() => fail(`game did not finish; moves=${moves}`), 240_000);
    const ranking = await ended;
    clearTimeout(timeout);

    const unique = new Set(ranking);
    if (ranking.length !== PLAYERS || unique.size !== PLAYERS) return fail(`bad ranking ${ranking.join(',')}`);
    const snap = snapshot as RoomSnapshot | null;
    const html = snap?.chat.find(m => m.type === 'user');
    console.log(`PASS players=${PLAYERS} moves=${moves} captures=${captures} chatMsgs=${chats} seconds=${((Date.now() - started) / 1000).toFixed(1)}`);
    console.log('chat sample (raw text is stored; client must render as text):', JSON.stringify(html?.text));
    clients.forEach(c => c.disconnect());
    process.exit(0);
}

main().catch(e => fail(String(e)));
