import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodSchema, ZodError } from "zod";
import { isValidObjectId } from "mongoose";
import { AuthRequest, BoardRole, ApiError, verifyAccessToken } from "./utils";
import { Board } from "./models";

// ─── Auth ─────────────────────────────────────────────────────

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return next(ApiError.unauthorized("Missing auth header"));

    const token = header.split(" ")[1];
    if (!token) return next(ApiError.unauthorized("No token"));

    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(ApiError.unauthorized("Invalid token"));
  }
}

// ─── Board Role Guard ─────────────────────────────────────────

/** Roles are a hierarchy: owner ⊃ editor ⊃ viewer. */
const ROLE_RANK: Record<BoardRole, number> = { viewer: 0, editor: 1, owner: 2 };

export function requireBoardRole(...roles: BoardRole[]) {
  // The guard takes the *lowest* listed role as the bar to clear.
  const required = Math.min(...roles.map((r) => ROLE_RANK[r]));

  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const boardId = req.params.boardId || req.body.boardId;
      if (!boardId) return next(ApiError.badRequest("Board ID required"));
      if (!isValidObjectId(boardId)) return next(ApiError.notFound("Board not found"));

      const board = await Board.findById(boardId);
      if (!board) return next(ApiError.notFound("Board not found"));

      const userId = req.user!.userId;
      if (board.owner.toString() === userId) {
        req.boardRole = "owner";
        return next();
      }

      const member = board.members.find((m: any) => m.user.toString() === userId);
      if (!member) return next(ApiError.forbidden("Not a board member"));

      if (ROLE_RANK[member.role] < required) return next(ApiError.forbidden("Insufficient role"));
      req.boardRole = member.role;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// ─── Validation ───────────────────────────────────────────────

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(ApiError.badRequest("Validation failed", error.errors.map((e) => ({ field: e.path.join("."), message: e.message }))));
      } else {
        next(error);
      }
    }
  };
}

// ─── Error Handler ────────────────────────────────────────────

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  console.error("[error]", err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
};
