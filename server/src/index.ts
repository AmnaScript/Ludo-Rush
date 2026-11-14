import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@ludo-rush/shared';
import { Room } from './rooms/Room';
import { RoomManager } from './rooms/RoomManager';

const port = Number(process.env.PORT ?? 5000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const app = express();
app.use(cors({ origin: clientOrigin }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ludo-rush-server' });
});

const server = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: clientOrigin, methods: ['GET', 'POST'] },
});

const rooms = new RoomManager(io);
const createLog = new Map<string, number[]>();

function allowCreate(ip: string): boolean {
  const now = Date.now();
  const recent = (createLog.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 8) return false;
  recent.push(now);
  createLog.set(ip, recent);
  return true;
}

io.on('connection', (socket) => {
  let room: Room | undefined;
  let memberId = '';
  let burst: number[] = [];

  /** Max 30 events per second per socket; extra events are dropped. */
  const limited = () => {
    const now = Date.now();
    burst = burst.filter((t) => now - t < 1000);
    if (burst.length >= 30) return true;
    burst.push(now);
    return false;
  };

  const me = () => (room ? room.memberOfSocket(socket.id) : undefined);
  const fail = (message: string) => socket.emit('error:msg', { message });

  const attach = (target: Room, id: string) => {
    room = target;
    memberId = id;
    void socket.join(target.channel);
    target.emitStateTo(socket.id);
    target.broadcastState();
  };

  socket.emit('app:connected', { message: 'Connected to Ludo Rush server' });

  socket.on('app:ping', (ack) => {
    if (typeof ack === 'function') ack({ message: 'pong', at: new Date().toISOString() });
  });

  socket.on('room:create', (payload, ack) => {
    if (typeof ack !== 'function' || limited()) return;
    if (room) return ack({ ok: false, error: 'Leave your current room first.' });
    const ip = socket.handshake.address;
    if (!allowCreate(ip)) return ack({ ok: false, error: 'Too many rooms created. Try again in a minute.' });
    const created = rooms.create();
    if (!created) return ack({ ok: false, error: 'The server is busy. Try again soon.' });
    const joined = created.join(payload?.nickname, socket.id);
    if ('error' in joined) return ack({ ok: false, error: joined.error });
    if (payload?.options) created.setOptions(joined.member, payload.options);
    ack(joined.ack);
    attach(created, joined.member.id);
  });

  socket.on('room:join', (payload, ack) => {
    if (typeof ack !== 'function' || limited()) return;
    if (room) return ack({ ok: false, error: 'Leave your current room first.' });
    const target = rooms.get(payload?.code);
    if (!target) return ack({ ok: false, error: 'Room not found. Check the code.' });
    const token = typeof payload.rejoinToken === 'string' ? payload.rejoinToken : undefined;
    const joined = target.join(payload.nickname, socket.id, token, payload.rejoinOnly === true);
    if ('error' in joined) return ack({ ok: false, error: joined.error });
    ack(joined.ack);
    attach(target, joined.member.id);
  });

  socket.on('room:leave', () => {
    if (!room || limited()) return;
    room.leave(memberId);
    void socket.leave(room.channel);
    room = undefined;
    memberId = '';
  });

  socket.on('room:options', (options) => {
    const m = me();
    if (!room || !m || limited()) return;
    const error = room.setOptions(m, options ?? {});
    if (error) fail(error);
  });

  socket.on('game:start', () => {
    const m = me();
    if (!room || !m || limited()) return;
    const error = room.start(m);
    if (error) fail(error);
  });

  socket.on('game:roll', () => {
    const m = me();
    if (!room || !m || limited()) return;
    const error = room.roll(m);
    if (error) fail(error);
  });

  socket.on('game:move', (payload) => {
    const m = me();
    if (!room || !m || limited()) return;
    const error = room.move(m, payload?.pieceId);
    if (error) fail(error);
  });

  socket.on('game:rematch', () => {
    const m = me();
    if (!room || !m || limited()) return;
    const error = room.rematch(m);
    if (error) fail(error);
  });

  socket.on('chat:send', (payload) => {
    const m = me();
    if (!room || !m || limited()) return;
    room.sendChat(m, payload?.text);
  });

  socket.on('disconnect', () => {
    room?.disconnect(socket.id);
  });
});

server.listen(port, () => {
  console.log(`Ludo Rush server on http://localhost:${port}`);
});
