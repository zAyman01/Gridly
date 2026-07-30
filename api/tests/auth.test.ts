import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.hoisted(() => {
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
});
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import jwt from "jsonwebtoken";
import { authHandlers, signupSchema, loginSchema } from "../routes";
import { validate, errorHandler } from "../middleware";
import { User } from "../models";

let mongo: MongoMemoryServer;
let app: express.Express;

function authMiddleware(req: any, _res: any, next: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return _res.status(401).json({ error: { code: "UNAUTHORIZED", message: "No token" } });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET!); next(); }
  catch { return _res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid token" } }); }
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  await mongoose.connect(uri);

  app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.post("/api/auth/signup", validate(signupSchema), authHandlers.signup);
  app.post("/api/auth/login", validate(loginSchema), authHandlers.login);
  app.post("/api/auth/refresh", authHandlers.refresh);
  app.get("/api/auth/me", authMiddleware, authHandlers.me);
  app.use(errorHandler);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("POST /api/auth/signup", () => {
  it("creates a user and returns tokens", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "test@example.com", password: "password123", name: "Test User" });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe("test@example.com");
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.headers["set-cookie"]).toBeTruthy();
  });

  it("rejects duplicate email", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "test@example.com", password: "password123", name: "Test User" });
    expect(res.status).toBe(409);
  });

  it("rejects invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "bad", password: "password123", name: "Test User" });
    expect(res.status).toBe(400);
  });

  it("rejects short password", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "a@b.com", password: "short", name: "Test User" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeAll(async () => {
    await User.create({ email: "login@example.com", password: "password123", name: "Login User" });
  });

  it("logs in with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it("rejects wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("rejects unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nonexistent@example.com", password: "password123" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  let refreshToken: string;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "refresh@example.com", password: "password123", name: "Refresh User" });
    const cookies = res.headers["set-cookie"];
    refreshToken = Array.isArray(cookies)
      ? cookies.find((c: string) => c.startsWith("refreshToken="))?.split(";")[0]?.replace("refreshToken=", "") || ""
      : "";
  });

  it("returns a new access token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refreshToken=${refreshToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it("rejects without cookie", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user", async () => {
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ email: "me@example.com", password: "password123", name: "Me User" });
    expect(signupRes.status).toBe(201);
    const token = signupRes.body.data.accessToken;

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("me@example.com");
  });

  it("rejects without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
