import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { createServer } from "http";
import { env } from "./config";
import { connectDB } from "./db";
import { authenticate, requireBoardRole, validate, errorHandler } from "./middleware";
import {
  authHandlers, boardHandlers, listHandlers, taskHandlers, userHandlers, activityHandlers,
  commentHandlers, checklistHandlers, attachmentHandlers,
  signupSchema, loginSchema, createBoardSchema, updateBoardSchema, addMemberSchema, updateMemberRoleSchema,
  createListSchema, updateListSchema, reorderListsSchema,
  createTaskSchema, updateTaskSchema, moveTaskSchema,
  createCommentSchema, updateCommentSchema,
  addChecklistItemSchema, toggleChecklistItemSchema, reorderChecklistSchema,
} from "./routes";
import workspaceRoutes from "./workspaceRoutes";
import analyticsRoutes from "./analyticsRoutes";
import aiRoutes from "./aiRoutes";
import { initSocket } from "./socket";

const app = express();

// Multer: memory storage for serverless + Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
});

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((s: string) => s.trim()), credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(cookieParser());
// Task descriptions are markdown and can be long, so 10kb is too tight.
app.use(express.json({ limit: "1mb" }));

app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false, message: { error: { code: "RATE_LIMITED", message: "Too many requests" } } }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: { code: "RATE_LIMITED", message: "Too many auth attempts" } } }));
// Model calls cost money — keep them on a short leash.
app.use("/api/ai", rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: { code: "RATE_LIMITED", message: "Too many AI requests" } } }));

// ─── Routes ──────────────────────────────────────────────────

app.post("/api/auth/signup", validate(signupSchema), authHandlers.signup);
app.post("/api/auth/login", validate(loginSchema), authHandlers.login);
app.post("/api/auth/refresh", authHandlers.refresh);
app.post("/api/auth/logout", authenticate, authHandlers.logout);
app.get("/api/auth/me", authenticate, authHandlers.me);

app.use("/api/workspaces", workspaceRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ai", aiRoutes);

app.post("/api/boards", authenticate, validate(createBoardSchema), boardHandlers.create);
app.get("/api/boards", authenticate, boardHandlers.list);
app.get("/api/boards/:boardId", authenticate, requireBoardRole("viewer"), boardHandlers.get);
app.put("/api/boards/:boardId", authenticate, requireBoardRole("editor"), validate(updateBoardSchema), boardHandlers.update);
app.delete("/api/boards/:boardId", authenticate, requireBoardRole("owner"), boardHandlers.remove);
app.post("/api/boards/:boardId/members", authenticate, requireBoardRole("editor"), validate(addMemberSchema), boardHandlers.addMember);
app.delete("/api/boards/:boardId/members/:userId", authenticate, requireBoardRole("owner"), boardHandlers.removeMember);

app.get("/api/boards/:boardId/lists", authenticate, requireBoardRole("viewer"), listHandlers.get);
app.post("/api/boards/:boardId/lists", authenticate, requireBoardRole("editor"), validate(createListSchema), listHandlers.create);
app.post("/api/boards/:boardId/lists/reorder", authenticate, requireBoardRole("editor"), validate(reorderListsSchema), listHandlers.reorder);
app.put("/api/boards/:boardId/lists/:listId", authenticate, requireBoardRole("editor"), validate(updateListSchema), listHandlers.update);
app.delete("/api/boards/:boardId/lists/:listId", authenticate, requireBoardRole("editor"), listHandlers.remove);

app.get("/api/boards/:boardId/tasks", authenticate, requireBoardRole("viewer"), taskHandlers.getByBoard);
app.post("/api/boards/:boardId/tasks", authenticate, requireBoardRole("editor"), validate(createTaskSchema), taskHandlers.create);
app.put("/api/boards/:boardId/tasks/:taskId", authenticate, requireBoardRole("editor"), validate(updateTaskSchema), taskHandlers.update);
app.delete("/api/boards/:boardId/tasks/:taskId", authenticate, requireBoardRole("editor"), taskHandlers.remove);
app.put("/api/boards/:boardId/tasks/:taskId/move", authenticate, requireBoardRole("editor"), validate(moveTaskSchema), taskHandlers.move);

// Comments
app.get("/api/boards/:boardId/tasks/:taskId/comments", authenticate, requireBoardRole("viewer"), commentHandlers.list);
app.post("/api/boards/:boardId/tasks/:taskId/comments", authenticate, requireBoardRole("editor"), validate(createCommentSchema), commentHandlers.create);
app.put("/api/boards/:boardId/tasks/:taskId/comments/:commentId", authenticate, requireBoardRole("editor"), validate(updateCommentSchema), commentHandlers.update);
app.delete("/api/boards/:boardId/tasks/:taskId/comments/:commentId", authenticate, requireBoardRole("editor"), commentHandlers.remove);

// Checklist
app.post("/api/boards/:boardId/tasks/:taskId/checklist", authenticate, requireBoardRole("editor"), validate(addChecklistItemSchema), checklistHandlers.add);
app.put("/api/boards/:boardId/tasks/:taskId/checklist/:itemId", authenticate, requireBoardRole("editor"), validate(toggleChecklistItemSchema), checklistHandlers.toggle);
app.delete("/api/boards/:boardId/tasks/:taskId/checklist/:itemId", authenticate, requireBoardRole("editor"), checklistHandlers.remove);
app.post("/api/boards/:boardId/tasks/:taskId/checklist/reorder", authenticate, requireBoardRole("editor"), validate(reorderChecklistSchema), checklistHandlers.reorder);

// Attachments
app.get("/api/boards/:boardId/tasks/:taskId/attachments", authenticate, requireBoardRole("viewer"), attachmentHandlers.list);
app.post("/api/boards/:boardId/tasks/:taskId/attachments", authenticate, requireBoardRole("editor"), upload.single("file"), attachmentHandlers.upload);
app.delete("/api/boards/:boardId/tasks/:taskId/attachments/:attachmentId", authenticate, requireBoardRole("editor"), attachmentHandlers.remove);

app.get("/api/boards/:boardId/activity", authenticate, requireBoardRole("viewer"), activityHandlers.list);
app.put("/api/boards/:boardId/members/:userId/role", authenticate, requireBoardRole("owner"), validate(updateMemberRoleSchema), boardHandlers.updateMemberRole);

app.get("/api/users/search", authenticate, userHandlers.search);

app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.use(errorHandler);

// ─── Vercel handler ───────────────────────────────────────────

export default async function handler(req: any, res: any) {
  try {
    await connectDB();
  } catch (err) {
    console.error("[db] connect error:", err);
    res.status(500).json({ error: { code: "DB_ERROR", message: "Database connection failed" } });
    return;
  }
  return new Promise<void>((resolve) => { res.on("finish", resolve); app(req, res); });
}

// ─── Dev server ───────────────────────────────────────────────

const isDev = process.argv[1]?.replace(/\\/g, "/").endsWith("api/index.ts");
if (isDev) {
  const port = env.PORT;
  (async () => {
    await connectDB();
    const server = createServer(app);
    initSocket(server);
    console.log(`[api] db connected → http://localhost:${port}`);
    server.listen(port);
  })().catch((err) => { console.error("[api] fatal:", err); process.exit(1); });
}

