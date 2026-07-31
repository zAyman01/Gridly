import { Request } from "express";
import jwt from "jsonwebtoken";
import { env } from "./config";

// ─── Types ────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  email: string;
  role: "admin" | "user";
}

export type BoardRole = "owner" | "editor" | "viewer";

export interface AuthRequest extends Request {
  user?: JwtPayload;
  boardRole?: BoardRole;
}

// ─── API Error ────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
  static badRequest(msg: string, details?: unknown) {
    return new ApiError(400, "BAD_REQUEST", msg, details);
  }
  static unauthorized(msg = "Unauthorized") {
    return new ApiError(401, "UNAUTHORIZED", msg);
  }
  static forbidden(msg = "Forbidden") {
    return new ApiError(403, "FORBIDDEN", msg);
  }
  static notFound(msg = "Resource not found") {
    return new ApiError(404, "NOT_FOUND", msg);
  }
  static conflict(msg: string) {
    return new ApiError(409, "CONFLICT", msg);
  }
}

// ─── JWT ──────────────────────────────────────────────────────

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
}
export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any });
}
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}
