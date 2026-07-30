import { Response, NextFunction, Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { Workspace, Board, List, Task, Comment, Attachment, ActivityLog, User } from "./models";
import { authenticate, validate } from "./middleware";
import { AuthRequest, ApiError } from "./utils";
import { deleteFile } from "./cloudinary";

const router = Router();

router.use(authenticate);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(60).regex(SLUG, "Slug may only contain lowercase letters, numbers, and dashes"),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

const addWorkspaceMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(["admin", "member", "guest"]).optional().default("member"),
});

type WorkspaceRole = "admin" | "member" | "guest";

/** Load a workspace the caller belongs to, or throw. */
async function memberWorkspace(req: AuthRequest, slug: string) {
  const workspace = await Workspace.findOne({ slug, "members.user": req.user!.userId });
  if (!workspace) throw ApiError.notFound("Workspace not found");
  return workspace;
}

function roleOf(workspace: { owner: any; members: { user: any; role: WorkspaceRole }[] }, userId: string): WorkspaceRole {
  if (workspace.owner.toString() === userId) return "admin";
  const member = workspace.members.find((m) => m.user.toString() === userId);
  return member?.role ?? "guest";
}

// GET /api/workspaces
router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workspaces = await Workspace.find({ "members.user": req.user!.userId })
      .sort({ createdAt: -1 })
      .populate("members.user", "name email avatar");
    res.json({ data: workspaces });
  } catch (err) { next(err); }
});

// POST /api/workspaces
router.post("/", validate(createWorkspaceSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, slug } = req.body;
    if (await Workspace.exists({ slug })) return next(ApiError.conflict("Slug already in use"));

    const workspace = await Workspace.create({
      name,
      slug,
      owner: req.user!.userId,
      members: [{ user: req.user!.userId, role: "admin" }],
    });
    res.status(201).json({ data: workspace });
  } catch (err) { next(err); }
});

// GET /api/workspaces/:slug
router.get("/:slug", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workspace = await memberWorkspace(req, req.params.slug as string);
    await workspace.populate("members.user", "name email avatar");

    const boards = await Board.find({
      workspace: workspace._id,
      $or: [{ owner: req.user!.userId }, { "members.user": req.user!.userId }],
    })
      .sort({ updatedAt: -1 })
      .populate("members.user", "name email avatar");

    res.json({ data: { workspace, boards, role: roleOf(workspace as any, req.user!.userId) } });
  } catch (err) { next(err); }
});

// PUT /api/workspaces/:slug
router.put("/:slug", validate(updateWorkspaceSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workspace = await memberWorkspace(req, req.params.slug as string);
    if (roleOf(workspace as any, req.user!.userId) !== "admin") return next(ApiError.forbidden("Admins only"));

    if (req.body.name) workspace.name = req.body.name;
    await workspace.save();
    res.json({ data: workspace });
  } catch (err) { next(err); }
});

// DELETE /api/workspaces/:slug — removes the workspace and everything under it
router.delete("/:slug", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workspace = await memberWorkspace(req, req.params.slug as string);
    if (workspace.owner.toString() !== req.user!.userId) return next(ApiError.forbidden("Only the owner can delete a workspace"));

    const boards = await Board.find({ workspace: workspace._id }).select("_id");
    const boardIds = boards.map((b) => b._id);

    const attachments = await Attachment.find({ board: { $in: boardIds } }).select("publicId");
    await Promise.all(attachments.map((a) => deleteFile(a.publicId).catch(() => {})));

    await Promise.all([
      Task.deleteMany({ board: { $in: boardIds } }),
      List.deleteMany({ board: { $in: boardIds } }),
      Comment.deleteMany({ board: { $in: boardIds } }),
      Attachment.deleteMany({ board: { $in: boardIds } }),
      ActivityLog.deleteMany({ board: { $in: boardIds } }),
      Board.deleteMany({ workspace: workspace._id }),
    ]);
    await workspace.deleteOne();

    res.json({ data: { message: "Workspace deleted" } });
  } catch (err) { next(err); }
});

// POST /api/workspaces/:slug/members
router.post("/:slug/members", validate(addWorkspaceMemberSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workspace = await memberWorkspace(req, req.params.slug as string);
    if (roleOf(workspace as any, req.user!.userId) !== "admin") return next(ApiError.forbidden("Admins only"));

    const { userId, role } = req.body;
    if (!isValidObjectId(userId)) return next(ApiError.badRequest("Invalid user id"));
    if (!(await User.exists({ _id: userId }))) return next(ApiError.notFound("User not found"));
    if (workspace.members.some((m) => m.user.toString() === userId)) return next(ApiError.conflict("Already a member"));

    workspace.members.push({ user: userId, role });
    await workspace.save();
    await workspace.populate("members.user", "name email avatar");
    res.json({ data: workspace });
  } catch (err) { next(err); }
});

// DELETE /api/workspaces/:slug/members/:userId
router.delete("/:slug/members/:userId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workspace = await memberWorkspace(req, req.params.slug as string);
    if (roleOf(workspace as any, req.user!.userId) !== "admin") return next(ApiError.forbidden("Admins only"));
    if (workspace.owner.toString() === req.params.userId) return next(ApiError.badRequest("Cannot remove the workspace owner"));

    const before = workspace.members.length;
    workspace.members = workspace.members.filter((m) => m.user.toString() !== req.params.userId) as any;
    if (workspace.members.length === before) return next(ApiError.notFound("Member not found"));

    await workspace.save();
    res.json({ data: workspace });
  } catch (err) { next(err); }
});

export default router;
