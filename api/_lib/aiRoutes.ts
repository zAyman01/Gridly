import { Router, Response, NextFunction } from "express";
import { authenticate, requireBoardRole } from "./middleware";
import { AuthRequest, ApiError } from "./utils";
import { Task, ActivityLog } from "./models";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "./config";
import { emitBoardChange } from "./socket";

const router = Router();
router.use(authenticate);

// Pinned rather than an alias so prompt behaviour cannot shift under us.
// Google retires ids: gemini-2.5-flash started answering 404 "no longer
// available to new users". Set GEMINI_MODEL to move when that repeats.
const MODEL = env.GEMINI_MODEL;

let client: GoogleGenerativeAI | null = null;
function model() {
  if (!env.GEMINI_API_KEY) {
    throw new ApiError(503, "AI_DISABLED", "AI features are not configured on this server");
  }
  client ??= new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return client.getGenerativeModel({ model: MODEL });
}

/** Load a task that really belongs to the board the caller was authorised against. */
async function boardTask(req: AuthRequest) {
  const task = await Task.findOne({ _id: req.params.taskId, board: req.params.boardId });
  if (!task) throw ApiError.notFound("Task not found");
  return task;
}

// POST /api/ai/boards/:boardId/tasks/:taskId/draft-description
router.post(
  "/boards/:boardId/tasks/:taskId/draft-description",
  requireBoardRole("editor"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const task = await boardTask(req);

      const prompt = `You are an expert product manager and technical writer.
Write a concise, professional task description (in Markdown) for a task titled "${task.title}".
The description should be structured, perhaps with a short goal, and a placeholder for acceptance criteria.
Do not include conversational filler like "Here is the description." Just output the markdown.`;

      const result = await model().generateContent(prompt);
      const text = result.response.text().trim();
      if (!text) return next(new ApiError(502, "AI_EMPTY", "The model returned no text"));

      task.description = text;
      await task.save();
      await ActivityLog.create({
        action: "ai.description_drafted", board: task.board, task: task._id,
        user: req.user!.userId, details: { title: task.title },
      });
      emitBoardChange(task.board.toString());

      res.json({ data: text });
    } catch (err) { next(err); }
  }
);

// POST /api/ai/boards/:boardId/tasks/:taskId/breakdown
router.post(
  "/boards/:boardId/tasks/:taskId/breakdown",
  requireBoardRole("editor"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const task = await boardTask(req);

      const prompt = `You are a senior engineer breaking down a task into actionable steps.
Task Title: "${task.title}"
Task Description: "${task.description || "No description provided."}"

Provide a checklist of 3 to 5 logical subtasks.
Format the output EXACTLY as a JSON array of strings, with no markdown code blocks or extra text.
Example: ["Set up database schema", "Create API endpoint", "Write unit tests"]`;

      const result = await model().generateContent(prompt);
      const text = result.response.text().replace(/```json/gi, "").replace(/```/g, "").trim();

      let steps: unknown;
      try { steps = JSON.parse(text); } catch { steps = null; }
      if (!Array.isArray(steps) || steps.some((s) => typeof s !== "string")) {
        console.error("[ai] unparseable breakdown:", text.slice(0, 400));
        return next(new ApiError(502, "AI_BAD_FORMAT", "The model returned an unexpected format"));
      }

      const cleaned = (steps as string[]).map((s) => s.trim()).filter(Boolean).slice(0, 10);
      const start = task.checklist.length;
      task.checklist.push(...cleaned.map((text, idx) => ({ text: text.slice(0, 500), done: false, position: start + idx })));
      await task.save();
      await ActivityLog.create({
        action: "ai.checklist_generated", board: task.board, task: task._id,
        user: req.user!.userId, details: { count: cleaned.length },
      });
      emitBoardChange(task.board.toString());

      res.json({ data: task.checklist });
    } catch (err) { next(err); }
  }
);

export default router;
