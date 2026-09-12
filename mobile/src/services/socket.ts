import { io, Socket } from 'socket.io-client';
import { getAuthToken, API_URL } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  const token = getAuthToken();
  const wsUrl = process.env.EXPO_PUBLIC_WS_URL || API_URL;

  if (!socket) {
    socket = io(wsUrl, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      const currentToken = getAuthToken();
      if (currentToken) {
        socket?.emit('authenticate', { token: currentToken });
      }
    });
  } else if (token && socket.auth && (socket.auth as any).token !== token) {
    socket.auth = { token };
    if (socket.connected) {
      socket.emit('authenticate', { token });
    } else {
      socket.connect();
    }
  } else if (token && !socket.connected) {
    socket.auth = { token };
    socket.connect();
  }

  return socket;
}

export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
