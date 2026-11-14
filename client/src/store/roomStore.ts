import { create } from 'zustand';
import type { ChatMessage, RoomSnapshot } from '@ludo-rush/shared';

export interface Session {
  code: string;
  playerId: string;
  rejoinToken: string;
  nickname: string;
  spectator: boolean;
}

type RoomState = {
  session: Session | null;
  snapshot: RoomSnapshot | null;
  chat: ChatMessage[];
  error: string | null;
  busy: boolean;
  setSession: (session: Session | null) => void;
  setSnapshot: (snapshot: RoomSnapshot | null) => void;
  addChat: (message: ChatMessage) => void;
  setError: (error: string | null) => void;
  setBusy: (busy: boolean) => void;
};

export const useRoomStore = create<RoomState>((set) => ({
  session: null,
  snapshot: null,
  chat: [],
  error: null,
  busy: false,
  setSession: (session) => set({ session }),
  setSnapshot: (snapshot) => set({ snapshot, chat: snapshot ? snapshot.chat : [] }),
  addChat: (message) =>
    set((state) =>
      state.chat.some((m) => m.id === message.id)
        ? state
        : { chat: [...state.chat, message].slice(-100) },
    ),
  setError: (error) => set({ error }),
  setBusy: (busy) => set({ busy }),
}));
