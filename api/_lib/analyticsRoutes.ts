import { Router, Response, NextFunction } from "express";
import { authenticate, requireBoardRole } from "./middleware";
import { AuthRequest, ApiError } from "./utils";
import { Workspace, Board, Task } from "./models";
import mongoose from "mongoose";

const router = Router();
router.use(authenticate);

async function getAggregatedAnalytics(boardIds: mongoose.Types.ObjectId[]) {
  // Aggregate tasks by status
  const statusAgg = await Task.aggregate([
    { $match: { board: { $in: boardIds } } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);

  // Aggregate tasks by priority
  const priorityAgg = await Task.aggregate([
    { $match: { board: { $in: boardIds } } },
    { $group: { _id: "$priority", count: { $sum: 1 } } }
  ]);

  // Aggregate tasks by assignee
  const assigneeAgg = await Task.aggregate([
    { $match: { board: { $in: boardIds } } },
    { $unwind: { path: "$assignees", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$assignees",
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user"
      }
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        userId: "$_id",
        name: { $ifNull: ["$user.name", "Unassigned"] },
        count: 1
      }
    }
  ]);

  // Velocity (tasks completed per day for last 14 days)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const velocityAgg = await Task.aggregate([
    {
      $match: {
        board: { $in: boardIds },
        status: "done",
        completedAt: { $gte: fourteenDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$completedAt" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Format the outputs
  const tasksByStatus = statusAgg.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), { todo: 0, in_progress: 0, done: 0 });
  const tasksByPriority = priorityAgg.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), { low: 0, medium: 0, high: 0, urgent: 0 });
  const tasksByAssignee = assigneeAgg.map(a => ({ name: a.name, count: a.count, userId: a.userId }));
  
  const totalTasks = Object.values(tasksByStatus).reduce((a, b) => (a as number) + (b as number), 0) as number;
  const completionRate = totalTasks > 0 ? (tasksByStatus.done / totalTasks) : 0;

  // Fill in zero for missing days in velocity
  const velocityMap = new Map<string, number>();
  velocityAgg.forEach(v => velocityMap.set(v._id, v.count));
  const velocity = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    velocity.push({
      date: dateStr,
      count: velocityMap.get(dateStr) || 0
    });
  }

  return {
    totalTasks,
    completionRate,
    tasksByStatus,
    tasksByPriority,
    tasksByAssignee,
    velocity
  };
}

// GET /api/analytics/workspace/:slug
router.get("/workspace/:slug", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workspace = await Workspace.findOne({ slug: req.params.slug, "members.user": req.user!.userId });
    if (!workspace) return next(ApiError.notFound("Workspace not found"));

    const boards = await Board.find({
      workspace: workspace._id,
      $or: [{ owner: req.user!.userId }, { "members.user": req.user!.userId }],
    }).select("_id");
    const boardIds = boards.map(b => b._id as mongoose.Types.ObjectId);

    const data = await getAggregatedAnalytics(boardIds);
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/analytics/board/:boardId
router.get("/board/:boardId", requireBoardRole("viewer"), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const boardId = new mongoose.Types.ObjectId(req.params.boardId as string);
    const data = await getAggregatedAnalytics([boardId]);
    res.json({ data });
  } catch (err) { next(err); }
});

export default router;
