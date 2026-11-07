/** Phase 0: shared transport contract. Game rules arrive in Phase 1. */
export interface PingResponse {
  message: 'pong';
  at: string;
}

export interface ClientToServerEvents {
  'app:ping': (ack: (response: PingResponse) => void) => void;
}

export interface ServerToClientEvents {
  'app:connected': (payload: { message: string }) => void;
}
