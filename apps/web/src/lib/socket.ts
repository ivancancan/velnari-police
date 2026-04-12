import { io, type Socket } from 'socket.io-client';

const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] ?? 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
      transports: ['websocket'],
      // Exponential backoff: 1s → 2s → 4s … up to 30s, forever
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.3,
      timeout: 10_000,
    });
  }
  return socket;
}

export function connectSocket(accessToken: string): Socket {
  const s = getSocket();
  s.auth = { token: accessToken };
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
