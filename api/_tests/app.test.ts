import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.hoisted(() => {
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
});
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../index";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("GET /api/health", () => {
  it("reports the database and optional integrations", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.db).toBe("connected");
    expect(res.body).toHaveProperty("uploads");
    expect(res.body).toHaveProperty("ai");
  });
});

describe("unknown API routes", () => {
  it("answers JSON, not Express's default HTML page", async () => {
    const res = await request(app).get("/api/not-a-real-endpoint");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("keeps the shape for a nested path", async () => {
    const res = await request(app).post("/api/boards/nope/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("auth guards", () => {
  it("rejects an unauthenticated board read", async () => {
    const res = await request(app).get("/api/boards");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("GET /api/boards", () => {
  it("rejects a non-id workspace filter instead of throwing a CastError", async () => {
    // Signing up through the real app keeps this honest about route wiring.
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({ email: "filter@example.com", password: "password123", name: "Filter" });
    expect(signup.status).toBe(201);
    const token = signup.body.data.accessToken;

    const res = await request(app)
      .get("/api/boards?workspace=not-an-object-id")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });
});
