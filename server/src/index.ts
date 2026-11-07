import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@ludo-rush/shared';

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

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.emit('app:connected', { message: 'Connected to Ludo Rush server' });
  socket.on('app:ping', (ack) => {
    if (typeof ack === 'function') ack({ message: 'pong', at: new Date().toISOString() });
  });
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`));
});

server.listen(port, () => {
  console.log(`Ludo Rush server on http://localhost:${port}`);
});
