import { create } from 'zustand';

type ConnectionState = {
  connected: boolean;
  status: string;
  setConnected: (connected: boolean) => void;
  setStatus: (status: string) => void;
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  connected: false,
  status: 'Connecting…',
  setConnected: (connected) => set({ connected }),
  setStatus: (status) => set({ status }),
}));
