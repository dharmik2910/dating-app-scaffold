import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

  if (!socket) {
    socket = io(wsUrl, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      const currentToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
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
