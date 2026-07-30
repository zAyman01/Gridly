import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyAccessToken } from "./utils";
import { env } from "./config";

let io: Server | null = null;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGIN.split(",").map((s: string) => s.trim()),
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No auth token"));

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      socket.data.email = payload.email;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("joinBoard", (boardId: string) => {
      socket.join(`board:${boardId}`);
    });

    socket.on("leaveBoard", (boardId: string) => {
      socket.leave(`board:${boardId}`);
    });
  });

  return io;
}

export function emitBoardChange(boardId: string) {
  io?.to(`board:${boardId}`).emit("boardChange");
}
