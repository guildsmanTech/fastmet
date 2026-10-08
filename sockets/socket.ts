import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.EXPO_PUBLIC_BASE_URL;

let socket: Socket | null = null;
let currentToken: string | null = null;

export const getSocket = (token: string) => {
  // Only recreate if token changed or socket doesn't exist
  if (!socket || currentToken !== token) {
    console.log(
      "🔄 Creating new socket with token:",
      token.substring(0, 20) + "..."
    );

    // Disconnect old socket
    if (socket) {
      socket.disconnect();
      socket.removeAllListeners();
    }

    // Create new socket
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    });

    currentToken = token;
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
    currentToken = null;
  }
};
