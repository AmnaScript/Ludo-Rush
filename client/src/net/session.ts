import type { Difficulty, JoinAck } from '@ludo-rush/shared';
import { socket } from './socket';
import { useConnectionStore } from '../store/connectionStore';
import { useRoomStore, type Session } from '../store/roomStore';

const KEY = 'ludo-rush-session';

function load(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function save(session: Session | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage can be blocked; the game still works without rejoin */
  }
}

export function savedNickname(): string {
  try {
    return localStorage.getItem('ludo-rush-nickname') ?? '';
  } catch {
    return '';
  }
}

function rememberNickname(nickname: string) {
  try {
    localStorage.setItem('ludo-rush-nickname', nickname);
  } catch {
    /* ignore */
  }
}

function adopt(ack: JoinAck, nickname: string): string | null {
  const room = useRoomStore.getState();
  if (!ack.ok) {
    room.setError(ack.error);
    return ack.error;
  }
  const session: Session = {
    code: ack.code,
    playerId: ack.playerId,
    rejoinToken: ack.rejoinToken,
    nickname,
    spectator: ack.spectator,
  };
  save(session);
  room.setSession(session);
  room.setError(null);
  return null;
}

let started = false;

/** Wire socket events into the stores once, and rejoin a saved room after reconnects. */
export function startSession() {
  if (started) return;
  started = true;

  const conn = useConnectionStore.getState();

  const tryRejoin = () => {
    const session = load();
    if (!session) return;
    socket.emit(
      'room:join',
      { code: session.code, nickname: session.nickname, rejoinToken: session.rejoinToken, rejoinOnly: true },
      (ack) => {
        if (ack.ok) adopt(ack, session.nickname);
        else {
          save(null);
          useRoomStore.getState().setSession(null);
          useRoomStore.getState().setSnapshot(null);
        }
      },
    );
  };

  socket.on('connect', () => {
    conn.setConnected(true);
    conn.setStatus('Connected');
    tryRejoin(); // after a reload or reconnect, take the saved seat back
  });
  socket.on('disconnect', () => {
    conn.setConnected(false);
    conn.setStatus('Reconnecting…');
  });
  socket.on('connect_error', () => {
    conn.setConnected(false);
    conn.setStatus('Unable to reach the server');
  });
  socket.on('room:state', (snapshot) => useRoomStore.getState().setSnapshot(snapshot));
  socket.on('chat:message', (message) => useRoomStore.getState().addChat(message));
  socket.on('error:msg', ({ message }) => useRoomStore.getState().setError(message));

  socket.connect();
}

export function createRoom(nickname: string, piecesPerPlayer: 1 | 2 | 4, difficulty: Difficulty) {
  const room = useRoomStore.getState();
  rememberNickname(nickname);
  room.setBusy(true);
  socket.timeout(8000).emit('room:create', { nickname, options: { piecesPerPlayer, difficulty } }, (err, ack) => {
    room.setBusy(false);
    if (err) return room.setError('The server did not answer. Is it running?');
    adopt(ack, nickname);
  });
}

export function joinRoom(code: string, nickname: string) {
  const room = useRoomStore.getState();
  rememberNickname(nickname);
  room.setBusy(true);
  socket.timeout(8000).emit('room:join', { code, nickname }, (err, ack) => {
    room.setBusy(false);
    if (err) return room.setError('The server did not answer. Is it running?');
    adopt(ack, nickname);
  });
}

export function leaveRoom() {
  socket.emit('room:leave');
  save(null);
  const room = useRoomStore.getState();
  room.setSession(null);
  room.setSnapshot(null);
}
