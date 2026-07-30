import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let listeners: Array<() => void> = [];

/** Vercel has no WebSocket support, so production falls back to REST polling. */
function socketUrl(): string | null {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) return configured;
  return import.meta.env.DEV ? "http://localhost:4000" : null;
}

export function isSocketLive(): boolean {
  return Boolean(socket?.connected);
}

export function getSocket(token?: string): Socket | null {
  if (socket?.connected) return socket;

  const url = socketUrl();
  if (!url) return null;

  try {
    socket = io(url, {
      auth: token ? { token } : undefined,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on("connect_error", (err) => {
      console.warn("[ws] connect_error:", err.message);
    });

    socket.on("connect", () => console.log("[ws] connected"));
    socket.on("disconnect", (reason) => {
      console.log("[ws] disconnected:", reason);
      // Degrade gracefully — board data still loaded via REST
    });

    return socket;
  } catch {
    console.warn("[ws] socket not available — degrading gracefully");
    return null;
  }
}

export function joinBoard(boardId: string) {
  socket?.emit("joinBoard", boardId);
}

export function leaveBoard(boardId: string) {
  socket?.emit("leaveBoard", boardId);
}

export function onBoardChange(callback: () => void): () => void {
  socket?.on("boardChange", callback);
  listeners.push(callback);
  return () => {
    socket?.off("boardChange", callback);
    listeners = listeners.filter((l) => l !== callback);
  };
}
