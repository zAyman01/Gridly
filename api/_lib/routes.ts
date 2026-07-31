import { Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { AuthRequest, ApiError, signAccessToken, signRefreshToken, verifyRefreshToken } from "./utils";
import { User, Workspace, Board, List, Task, ActivityLog, Comment, Attachment } from "./models";
import { emitBoardChange } from "./socket";
import { uploadFile, deleteFile, isUploadConfigured } from "./cloudinary";
import { env } from "./config";

// ═════════════════════════════════════════════════════════════
// Route handlers — each file exports a Router with its routes
// ═════════════════════════════════════════════════════════════

// ─── Auth Routes ──────────────────────────────────────────────

/** One definition, so the three places that set this cookie cannot drift. */
const REFRESH_COOKIE = {
  httpOnly: true,
  secure: env.IS_PRODUCTION,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
} as const;

export const signupSchema = z.object({ email: z.string().email().max(255), password: z.string().min(8).max(128), name: z.string().min(1).max(100) });
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const authHandlers = {
  signup: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { email, password, name } = req.body;
      if (await User.findOne({ email })) return next(ApiError.conflict("Email already registered"));

      const user = await User.create({ email, password, name });
      const payload = { userId: user.id, email: user.email, role: user.role };
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      user.refreshToken = await bcrypt.hash(refreshToken, 12);
      await user.save();

      res.cookie("refreshToken", refreshToken, REFRESH_COOKIE);
      res.status(201).json({ data: { user: user.toJSON(), accessToken } });
    } catch (err) { next(err); }
  },

  login: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select("+password");
      if (!user || !(await user.comparePassword(password))) return next(ApiError.unauthorized("Invalid email or password"));

      const payload = { userId: user.id, email: user.email, role: user.role };
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      user.refreshToken = await bcrypt.hash(refreshToken, 12);
      await user.save();

      res.cookie("refreshToken", refreshToken, REFRESH_COOKIE);
      res.json({ data: { user: user.toJSON(), accessToken } });
    } catch (err) { next(err); }
  },

  refresh: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.refreshToken;
      if (!token) return next(ApiError.unauthorized("No refresh token"));

      let payload: any;
      try { payload = verifyRefreshToken(token); } catch { return next(ApiError.unauthorized("Invalid refresh token")); }

      const user = await User.findById(payload.userId).select("+refreshToken");
      if (!user?.refreshToken || !(await bcrypt.compare(token, user.refreshToken))) return next(ApiError.unauthorized("Token revoked"));

      const newPayload = { userId: user.id, email: user.email, role: user.role };
      const newAccess = signAccessToken(newPayload);
      const newRefresh = signRefreshToken(newPayload);

      user.refreshToken = await bcrypt.hash(newRefresh, 12);
      await user.save();

      res.cookie("refreshToken", newRefresh, REFRESH_COOKIE);
      res.json({ data: { accessToken: newAccess } });
    } catch (err) { next(err); }
  },

  logout: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.user!.userId).select("+refreshToken");
      if (user) { user.refreshToken = undefined as any; await user.save(); }
      res.clearCookie("refreshToken", { path: "/api/auth" });
      res.json({ data: { message: "Logged out" } });
    } catch (err) { next(err); }
  },

  me: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.user!.userId);
      if (!user) return next(ApiError.notFound("User not found"));
      res.json({ data: user });
    } catch (err) { next(err); }
  },
};

// ─── Board Routes ─────────────────────────────────────────────

const customFieldSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["text", "number", "date", "select", "multiselect", "checkbox"]),
  options: z.array(z.string().max(80)).optional(),
  required: z.boolean().optional(),
});

export const createBoardSchema = z.object({ title: z.string().min(1).max(200), description: z.string().max(1000).optional(), workspace: z.string().min(1) });
export const updateBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  visibility: z.enum(["workspace", "private"]).optional(),
  customFields: z.array(customFieldSchema).max(30).optional(),
});
export const addMemberSchema = z.object({ userId: z.string(), role: z.enum(["editor", "viewer"]).optional().default("viewer") });
export const updateMemberRoleSchema = z.object({ role: z.enum(["editor", "viewer"]) });

export const boardHandlers = {
  list: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query: any = { $or: [{ owner: req.user!.userId }, { "members.user": req.user!.userId }] };
      // `?workspace[$ne]=x` arrives as an object under Express's query parser,
      // and anything that is not an id makes Mongoose throw a CastError.
      const workspace = req.query.workspace;
      if (workspace !== undefined) {
        if (typeof workspace !== "string" || !isValidObjectId(workspace)) {
          return next(ApiError.badRequest("Invalid workspace id"));
        }
        query.workspace = workspace;
      }
      const boards = await Board.find(query).sort({ updatedAt: -1 });
      res.json({ data: boards });
    } catch (err) { next(err); }
  },

  get: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const board = await Board.findById(req.params.boardId).populate("owner", "name email").populate("members.user", "name email avatar").populate("workspace");
      if (!board) return next(ApiError.notFound("Board not found"));

      const lists = await List.find({ board: board._id }).sort({ position: 1 });
      const tasks = await Task.find({ board: board._id }).sort({ position: 1 }).populate("assignees", "name email avatar").populate("createdBy", "name email avatar");

      const tasksByList: Record<string, typeof tasks> = {};
      for (const l of lists) tasksByList[l._id.toString()] = tasks.filter((t) => t.list.toString() === l._id.toString());

      res.json({ data: { board, lists, tasksByList } });
    } catch (err) { next(err); }
  },

  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { title, description, workspace } = req.body;
      if (!isValidObjectId(workspace)) return next(ApiError.badRequest("Invalid workspace"));

      // A board can only be created inside a workspace the caller belongs to.
      const ws = await Workspace.findOne({ _id: workspace, "members.user": req.user!.userId });
      if (!ws) return next(ApiError.forbidden("Not a member of that workspace"));

      const board = await Board.create({
        title, description, workspace,
        owner: req.user!.userId,
        members: [{ user: req.user!.userId, role: "owner" }],
      });
      await ActivityLog.create({ action: "board.created", board: board._id, user: req.user!.userId, details: { title: board.title } });
      res.status(201).json({ data: board });
    } catch (err) { next(err); }
  },

  update: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const prev = await Board.findById(req.params.boardId);
      const board = await Board.findByIdAndUpdate(req.params.boardId, { $set: req.body }, { new: true, runValidators: true });
      if (!board) return next(ApiError.notFound("Board not found"));
      await ActivityLog.create({ action: "board.updated", board: board._id, user: req.user!.userId, details: { oldTitle: prev?.title, newTitle: board.title } });
      emitBoardChange(board._id.toString());
      res.json({ data: board });
    } catch (err) { next(err); }
  },

  remove: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const board = await Board.findByIdAndDelete(req.params.boardId);
      if (!board) return next(ApiError.notFound("Board not found"));

      // Everything hanging off the board goes with it, including remote files.
      const attachments = await Attachment.find({ board: board._id }).select("publicId");
      await Promise.all(attachments.map((a) => deleteFile(a.publicId).catch(() => {})));

      await Promise.all([
        List.deleteMany({ board: board._id }),
        Task.deleteMany({ board: board._id }),
        Comment.deleteMany({ board: board._id }),
        Attachment.deleteMany({ board: board._id }),
        ActivityLog.deleteMany({ board: board._id }),
      ]);
      res.json({ data: { message: "Board deleted" } });
    } catch (err) { next(err); }
  },

  addMember: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const board = await Board.findById(req.params.boardId);
      if (!board) return next(ApiError.notFound("Board not found"));
      if (!isValidObjectId(req.body.userId)) return next(ApiError.badRequest("Invalid user id"));
      if (!(await User.exists({ _id: req.body.userId }))) return next(ApiError.notFound("User not found"));
      if (board.members.some((m: any) => m.user.toString() === req.body.userId)) return next(ApiError.conflict("Already a member"));
      board.members.push({ user: req.body.userId, role: req.body.role || "viewer" });
      await board.save();
      const added = await User.findById(req.body.userId).select("name email");
      await ActivityLog.create({ action: "member.added", board: board._id, user: req.user!.userId, details: { memberId: req.body.userId, memberName: added?.name, role: req.body.role || "viewer" } });
      emitBoardChange(board._id.toString());
      res.json({ data: board });
    } catch (err) { next(err); }
  },

  removeMember: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const board = await Board.findById(boardId);
      if (!board) return next(ApiError.notFound("Board not found"));
      if (board.owner.toString() === req.params.userId) return next(ApiError.badRequest("Cannot remove the board owner"));
      const removed = board.members.find((m: any) => m.user.toString() === req.params.userId);
      if (!removed) return next(ApiError.notFound("Member not found"));
      board.members = board.members.filter((m: any) => m.user.toString() !== req.params.userId) as any;
      await board.save();
      // Drop the removed member from any task they were assigned to.
      await Task.updateMany({ board: board._id }, { $pull: { assignees: req.params.userId } });
      await ActivityLog.create({ action: "member.removed", board: board._id, user: req.user!.userId, details: { memberId: req.params.userId, role: removed.role } });
      emitBoardChange(board._id.toString());
      res.json({ data: board });
    } catch (err) { next(err); }
  },

  updateMemberRole: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const board = await Board.findById(boardId);
      if (!board) return next(ApiError.notFound("Board not found"));
      const member = board.members.find((m: any) => m.user.toString() === req.params.userId);
      if (!member) return next(ApiError.notFound("Member not found"));
      if (member.role === "owner") return next(ApiError.badRequest("Cannot change owner's role"));
      member.role = req.body.role;
      await board.save();
      await ActivityLog.create({ action: "member.role_updated", board: board._id, user: req.user!.userId, details: { memberId: req.params.userId, newRole: req.body.role } });
      emitBoardChange(board._id.toString());
      res.json({ data: board });
    } catch (err) { next(err); }
  },
};

// ─── List Routes ──────────────────────────────────────────────

export const createListSchema = z.object({ title: z.string().min(1).max(200), position: z.number().int().min(0).optional() });
export const updateListSchema = z.object({ title: z.string().min(1).max(200).optional(), position: z.number().int().min(0).optional() });
export const reorderListsSchema = z.object({ orders: z.array(z.object({ listId: z.string(), position: z.number().int().min(0) })).min(1) });

export const listHandlers = {
  get: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const lists = await List.find({ board: boardId }).sort({ position: 1 });
      res.json({ data: lists });
    } catch (err) { next(err); }
  },

  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const last = await List.findOne({ board: boardId }).sort({ position: -1 }).select("position");
      const list = await List.create({ title: req.body.title, board: boardId, position: (last?.position ?? -1) + 1 });
      await ActivityLog.create({ action: "list.created", board: boardId, list: list._id, user: req.user!.userId, details: { title: list.title } });
      emitBoardChange(boardId);
      res.status(201).json({ data: list });
    } catch (err) { next(err); }
  },

  update: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const prev = await List.findOne({ _id: req.params.listId, board: boardId });
      const list = await List.findOneAndUpdate({ _id: req.params.listId, board: boardId }, { $set: req.body }, { new: true, runValidators: true });
      if (!list) return next(ApiError.notFound("List not found"));
      await ActivityLog.create({ action: "list.updated", board: boardId, list: list._id, user: req.user!.userId, details: { oldTitle: prev?.title, newTitle: list.title } });
      emitBoardChange(boardId);
      res.json({ data: list });
    } catch (err) { next(err); }
  },

  remove: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const list = await List.findOneAndDelete({ _id: req.params.listId, board: boardId });
      if (!list) return next(ApiError.notFound("List not found"));
      const taskIds = (await Task.find({ list: list._id, board: boardId }).select("_id")).map((t) => t._id);
      await cascadeDeleteTasks(taskIds as any[], boardId);
      await ActivityLog.create({ action: "list.deleted", board: boardId, user: req.user!.userId, details: { title: list.title } });
      emitBoardChange(boardId);
      res.json({ data: { message: "List deleted" } });
    } catch (err) { next(err); }
  },

  reorder: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      await List.bulkWrite(req.body.orders.map((o: any) => ({
        updateOne: { filter: { _id: o.listId, board: boardId }, update: { $set: { position: o.position } } },
      })));
      await ActivityLog.create({ action: "list.reordered", board: boardId, user: req.user!.userId, details: { orders: req.body.orders } });
      emitBoardChange(boardId);
      res.json({ data: { message: "Lists reordered" } });
    } catch (err) { next(err); }
  },
};

// ─── Task Routes ──────────────────────────────────────────────

export const createTaskSchema = z.object({
  listId: z.string(), title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().default(""),
  position: z.number().int().min(0).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  status: z.enum(["todo", "in_progress", "done"]).optional().default("todo"),
  assignees: z.array(z.string()).optional().default([]),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string().max(50)).optional().default([]),
});

/** Only these fields may be written through PUT /tasks/:taskId. */
export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(50000).optional(),
  listId: z.string().optional(),
  position: z.number().int().min(0).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  assignees: z.array(z.string()).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  tags: z.array(z.string().max(50)).max(30).optional(),
  coverImage: z.string().url().nullable().optional(),
  customFieldValues: z.record(z.any()).optional(),
  dependencies: z.array(z.object({ task: z.string(), type: z.enum(["blocks", "blocked_by"]) })).max(50).optional(),
});

export const moveTaskSchema = z.object({ targetListId: z.string(), position: z.number().int().min(0) });

/** Remove tasks plus everything that points at them. */
async function cascadeDeleteTasks(taskIds: unknown[], boardId: string): Promise<void> {
  if (taskIds.length === 0) return;
  const attachments = await Attachment.find({ task: { $in: taskIds } }).select("publicId");
  await Promise.all(attachments.map((a) => deleteFile(a.publicId).catch(() => {})));
  await Promise.all([
    Task.deleteMany({ _id: { $in: taskIds }, board: boardId }),
    Comment.deleteMany({ task: { $in: taskIds } }),
    Attachment.deleteMany({ task: { $in: taskIds } }),
    // Other cards must not keep dangling blocks / blocked-by links.
    Task.updateMany({ board: boardId }, { $pull: { dependencies: { task: { $in: taskIds } } } }),
  ]);
}

export const taskHandlers = {
  getByBoard: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const tasks = await Task.find({ board: boardId }).sort({ position: 1 }).populate(["assignees", "createdBy"]);
      res.json({ data: tasks });
    } catch (err) { next(err); }
  },

  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { listId, title, description, position, priority, status, assignees, dueDate, tags } = req.body;
      const boardId = req.params.boardId as string;

      if (!isValidObjectId(listId)) return next(ApiError.badRequest("Invalid list id"));
      if (!(await List.exists({ _id: listId, board: boardId }))) {
        return next(ApiError.badRequest("List is not on this board"));
      }

      let pos = position;
      if (pos === undefined) {
        const last = await Task.findOne({ list: listId, board: boardId }).sort({ position: -1 }).select("position");
        pos = (last?.position ?? -1) + 1;
      }

      const task = await Task.create({
        title, description, board: boardId, list: listId, position: pos,
        priority: priority || "medium", status: status || "todo",
        assignees: assignees || [], tags: tags || [],
        dueDate: dueDate ? new Date(dueDate) : undefined,
        createdBy: req.user!.userId,
      });
      await ActivityLog.create({ action: "task.created", board: boardId, list: listId, task: task._id, user: req.user!.userId, details: { title: task.title } });
      emitBoardChange(boardId);
      res.status(201).json({ data: await task.populate(["assignees", "createdBy"]) });
    } catch (err) { next(err); }
  },

  update: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const updateData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(req.body)) {
        if (v === undefined) continue;
        if (k === "dueDate") { updateData.dueDate = v ? new Date(v as string) : null; continue; }
        // The client calls the field listId; the model calls it list.
        if (k === "listId") { updateData.list = v; continue; }
        updateData[k] = v;
      }

      if (updateData.list) {
        const targetList = await List.exists({ _id: updateData.list, board: boardId });
        if (!targetList) return next(ApiError.badRequest("Target list is not on this board"));
      }

      if (updateData.status === "done") {
        updateData.completedAt = new Date();
      } else if (updateData.status && updateData.status !== "done") {
        updateData.completedAt = null;
      }

      const task = await Task.findOneAndUpdate({ _id: req.params.taskId, board: boardId }, { $set: updateData }, { new: true, runValidators: true }).populate(["assignees", "createdBy"]);
      if (!task) return next(ApiError.notFound("Task not found"));
      await ActivityLog.create({ action: "task.updated", board: boardId, list: task.list, task: task._id, user: req.user!.userId, details: { title: task.title } });
      emitBoardChange(boardId);
      res.json({ data: task });
    } catch (err) { next(err); }
  },

  remove: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const task = await Task.findOne({ _id: req.params.taskId, board: boardId });
      if (!task) return next(ApiError.notFound("Task not found"));
      await cascadeDeleteTasks([task._id], boardId);
      await ActivityLog.create({ action: "task.deleted", board: boardId, user: req.user!.userId, details: { title: task.title } });
      emitBoardChange(boardId);
      res.json({ data: { message: "Task deleted" } });
    } catch (err) { next(err); }
  },

  move: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const { targetListId, position } = req.body;

      if (!isValidObjectId(targetListId)) return next(ApiError.badRequest("Invalid list id"));
      if (!(await List.exists({ _id: targetListId, board: boardId }))) {
        return next(ApiError.badRequest("Target list is not on this board"));
      }

      const task = await Task.findOneAndUpdate({ _id: req.params.taskId, board: boardId }, { $set: { list: targetListId, position } }, { new: true, runValidators: true });
      if (!task) return next(ApiError.notFound("Task not found"));

      // Re-pack positions in the destination list so ordering stays stable.
      const siblings = await Task.find({ board: boardId, list: targetListId, _id: { $ne: task._id } }).sort({ position: 1 }).select("_id");
      const ordered = [...siblings.map((s) => s._id.toString())];
      ordered.splice(Math.min(position, ordered.length), 0, task._id.toString());
      await Task.bulkWrite(ordered.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { position: i } } } })));
      await ActivityLog.create({ action: "task.moved", board: boardId, list: task.list, task: task._id, user: req.user!.userId, details: { title: task.title, targetListId: req.body.targetListId, position: req.body.position } });
      emitBoardChange(boardId);
      res.json({ data: task });
    } catch (err) { next(err); }
  },
};

// ─── User Routes ──────────────────────────────────────────────

export const userHandlers = {
  search: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const q = ((req.query.q as string) || "").trim();
      if (!q) return res.json({ data: [] });
      // Treat the query as literal text, not as a user-supplied regex.
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const users = await User.find({ $or: [{ email: { $regex: safe, $options: "i" } }, { name: { $regex: safe, $options: "i" } }] })
        .limit(10)
        .select("_id name email avatar");
      res.json({ data: users });
    } catch (err) { next(err); }
  },
};

// ─── Activity Routes ──────────────────────────────────────────

export const activityHandlers = {
  list: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const logs = await ActivityLog.find({ board: boardId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("user", "name email avatar");
      res.json({ data: logs });
    } catch (err) { next(err); }
  },
};

// ─── Comment Routes ───────────────────────────────────────────

export const createCommentSchema = z.object({
  body: z.string().min(1).max(10000),
  mentions: z.array(z.string()).optional().default([]),
});

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(10000),
});

export const commentHandlers = {
  list: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const comments = await Comment.find({ task: req.params.taskId, board: req.params.boardId })
        .sort({ createdAt: 1 })
        .populate("author", "name email avatar");
      res.json({ data: comments });
    } catch (err) { next(err); }
  },

  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const taskId = req.params.taskId as string;

      const task = await Task.findOne({ _id: taskId, board: boardId });
      if (!task) return next(ApiError.notFound("Task not found"));

      const comment = await Comment.create({
        task: taskId,
        board: boardId,
        author: req.user!.userId,
        body: req.body.body,
        mentions: req.body.mentions || [],
      });

      await ActivityLog.create({
        action: "comment.created", board: boardId, task: taskId,
        user: req.user!.userId, details: { preview: req.body.body.slice(0, 100) },
      });
      emitBoardChange(boardId);

      const populated = await comment.populate("author", "name email avatar");
      res.status(201).json({ data: populated });
    } catch (err) { next(err); }
  },

  update: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const comment = await Comment.findOne({
        _id: req.params.commentId,
        task: req.params.taskId,
        board: req.params.boardId,
      });
      if (!comment) return next(ApiError.notFound("Comment not found"));
      if (comment.author.toString() !== req.user!.userId) {
        return next(ApiError.forbidden("Can only edit your own comments"));
      }

      comment.body = req.body.body;
      await comment.save();
      emitBoardChange(req.params.boardId as string);
      const populated = await comment.populate("author", "name email avatar");
      res.json({ data: populated });
    } catch (err) { next(err); }
  },

  remove: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const comment = await Comment.findOne({
        _id: req.params.commentId,
        task: req.params.taskId,
        board: req.params.boardId,
      });
      if (!comment) return next(ApiError.notFound("Comment not found"));
      // Authors delete their own; board owners moderate anyone's.
      if (comment.author.toString() !== req.user!.userId && req.boardRole !== "owner") {
        return next(ApiError.forbidden("Can only delete your own comments"));
      }

      await comment.deleteOne();
      emitBoardChange(req.params.boardId as string);
      res.json({ data: { message: "Comment deleted" } });
    } catch (err) { next(err); }
  },
};

// ─── Checklist Routes ─────────────────────────────────────────

export const addChecklistItemSchema = z.object({
  text: z.string().min(1).max(500),
});

export const toggleChecklistItemSchema = z.object({
  done: z.boolean(),
});

export const reorderChecklistSchema = z.object({
  orders: z.array(z.object({ itemId: z.string(), position: z.number().int().min(0) })).min(1),
});

export const checklistHandlers = {
  add: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const task = await Task.findOne({ _id: req.params.taskId, board: boardId });
      if (!task) return next(ApiError.notFound("Task not found"));

      const position = task.checklist.length;
      task.checklist.push({ text: req.body.text, done: false, position });
      await task.save();
      emitBoardChange(boardId);
      res.status(201).json({ data: task.checklist });
    } catch (err) { next(err); }
  },

  toggle: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const task = await Task.findOne({ _id: req.params.taskId, board: boardId });
      if (!task) return next(ApiError.notFound("Task not found"));

      const item = (task.checklist as any).id(req.params.itemId);
      if (!item) return next(ApiError.notFound("Checklist item not found"));

      item.done = req.body.done;
      await task.save();
      emitBoardChange(boardId);
      res.json({ data: task.checklist });
    } catch (err) { next(err); }
  },

  remove: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const task = await Task.findOne({ _id: req.params.taskId, board: boardId });
      if (!task) return next(ApiError.notFound("Task not found"));

      const item = (task.checklist as any).id(req.params.itemId);
      if (!item) return next(ApiError.notFound("Checklist item not found"));

      item.deleteOne();
      await task.save();
      emitBoardChange(boardId);
      res.json({ data: task.checklist });
    } catch (err) { next(err); }
  },

  reorder: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const task = await Task.findOne({ _id: req.params.taskId, board: boardId });
      if (!task) return next(ApiError.notFound("Task not found"));

      const { orders } = req.body as { orders: { itemId: string; position: number }[] };
      for (const o of orders) {
        const item = (task.checklist as any).id(o.itemId);
        if (item) item.position = o.position;
      }
      task.checklist.sort((a, b) => a.position - b.position);
      await task.save();
      emitBoardChange(boardId);
      res.json({ data: task.checklist });
    } catch (err) { next(err); }
  },
};

// ─── Attachment Routes ────────────────────────────────────────

export const attachmentHandlers = {
  list: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const attachments = await Attachment.find({
        task: req.params.taskId, board: req.params.boardId,
      }).sort({ createdAt: -1 }).populate("uploader", "name email avatar");
      res.json({ data: attachments });
    } catch (err) { next(err); }
  },

  upload: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const taskId = req.params.taskId as string;
      const file = (req as any).file as Express.Multer.File | undefined;

      if (!file) return next(ApiError.badRequest("No file uploaded"));
      if (!isUploadConfigured()) return next(new ApiError(503, "UPLOADS_DISABLED", "File uploads are not configured on this server"));

      const task = await Task.findOne({ _id: taskId, board: boardId });
      if (!task) return next(ApiError.notFound("Task not found"));

      const { url, publicId } = await uploadFile(
        file.buffer, file.originalname, `${env.CLOUDINARY_FOLDER}/${boardId}`
      );

      const attachment = await Attachment.create({
        task: taskId,
        board: boardId,
        uploader: req.user!.userId,
        filename: file.originalname,
        url,
        publicId,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      });

      await ActivityLog.create({
        action: "attachment.uploaded", board: boardId, task: taskId,
        user: req.user!.userId, details: { filename: file.originalname },
      });
      emitBoardChange(boardId);

      const populated = await attachment.populate("uploader", "name email avatar");
      res.status(201).json({ data: populated });
    } catch (err) { next(err); }
  },

  remove: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const boardId = req.params.boardId as string;
      const attachment = await Attachment.findOne({
        _id: req.params.attachmentId,
        task: req.params.taskId,
        board: boardId,
      });
      if (!attachment) return next(ApiError.notFound("Attachment not found"));

      await deleteFile(attachment.publicId);
      await attachment.deleteOne();

      await ActivityLog.create({
        action: "attachment.deleted", board: boardId, task: req.params.taskId,
        user: req.user!.userId, details: { filename: attachment.filename },
      });
      emitBoardChange(boardId);
      res.json({ data: { message: "Attachment deleted" } });
    } catch (err) { next(err); }
  },
};

