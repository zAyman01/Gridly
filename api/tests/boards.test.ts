import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

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
import { authHandlers, signupSchema, loginSchema, boardHandlers, createBoardSchema, addMemberSchema, updateMemberRoleSchema, listHandlers, taskHandlers, createTaskSchema, updateTaskSchema, moveTaskSchema, activityHandlers, userHandlers } from "../routes";
import { authenticate, requireBoardRole, validate, errorHandler } from "../middleware";
import { User, Workspace, Board, List, Task, ActivityLog } from "../models";

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

  app.post("/api/boards", authMiddleware, validate(createBoardSchema), boardHandlers.create);
  app.get("/api/boards", authMiddleware, boardHandlers.list);
  app.get("/api/boards/:boardId", authMiddleware, requireBoardRole("viewer"), boardHandlers.get);
  app.put("/api/boards/:boardId", authMiddleware, requireBoardRole("editor"), boardHandlers.update);
  app.delete("/api/boards/:boardId", authMiddleware, requireBoardRole("owner"), boardHandlers.remove);
  app.post("/api/boards/:boardId/members", authMiddleware, requireBoardRole("editor"), validate(addMemberSchema), boardHandlers.addMember);
  app.delete("/api/boards/:boardId/members/:userId", authMiddleware, requireBoardRole("owner"), boardHandlers.removeMember);
  app.put("/api/boards/:boardId/members/:userId/role", authMiddleware, requireBoardRole("owner"), validate(updateMemberRoleSchema), boardHandlers.updateMemberRole);

  app.post("/api/boards/:boardId/lists", authMiddleware, requireBoardRole("editor"), listHandlers.create);
  app.put("/api/boards/:boardId/lists/:listId", authMiddleware, requireBoardRole("editor"), listHandlers.update);
  app.delete("/api/boards/:boardId/lists/:listId", authMiddleware, requireBoardRole("editor"), listHandlers.remove);
  app.post("/api/boards/:boardId/lists/reorder", authMiddleware, requireBoardRole("editor"), listHandlers.reorder);

  app.post("/api/boards/:boardId/tasks", authMiddleware, requireBoardRole("editor"), validate(createTaskSchema), taskHandlers.create);
  app.put("/api/boards/:boardId/tasks/:taskId", authMiddleware, requireBoardRole("editor"), validate(updateTaskSchema), taskHandlers.update);
  app.delete("/api/boards/:boardId/tasks/:taskId", authMiddleware, requireBoardRole("editor"), taskHandlers.remove);
  app.put("/api/boards/:boardId/tasks/:taskId/move", authMiddleware, requireBoardRole("editor"), validate(moveTaskSchema), taskHandlers.move);

  app.get("/api/boards/:boardId/activity", authMiddleware, requireBoardRole("viewer"), activityHandlers.list);
  app.get("/api/users/search", authMiddleware, userHandlers.search);

  app.use(errorHandler);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

async function signupAndToken(email: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ email, password: "password123", name: email.split("@")[0] });
  expect(res.status).toBe(201);
  return res.body.data.accessToken;
}

/** Boards live inside a workspace, so every board test needs one first. */
async function workspaceFor(token: string): Promise<string> {
  const { userId } = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
  const existing = await Workspace.findOne({ "members.user": userId });
  if (existing) return existing._id.toString();
  const created = await Workspace.create({
    name: "Test Workspace",
    slug: `ws-${userId}`,
    owner: userId,
    members: [{ user: userId, role: "admin" }],
  });
  return created._id.toString();
}

async function createBoard(token: string, title = "Test Board"): Promise<string> {
  const workspace = await workspaceFor(token);
  const res = await request(app)
    .post("/api/boards")
    .set("Authorization", `Bearer ${token}`)
    .send({ title, workspace });
  expect(res.status).toBe(201);
  return res.body.data._id;
}

describe("Board CRUD", () => {
  let token: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Workspace.deleteMany({});
    await Board.deleteMany({});
    token = await signupAndToken("board@example.com");
  });

  it("creates a board", async () => {
    const workspace = await workspaceFor(token);
    const res = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "My Board", workspace });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("My Board");
    expect(res.body.data.members[0].role).toBe("owner");
  });

  it("lists user boards", async () => {
    await createBoard(token, "Board A");
    await createBoard(token, "Board B");
    const res = await request(app)
      .get("/api/boards")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it("gets board detail with lists and tasks", async () => {
    const boardId = await createBoard(token);
    const listRes = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "To Do" });
    expect(listRes.status).toBe(201);
    const listId = listRes.body.data._id;

    await request(app)
      .post(`/api/boards/${boardId}/tasks`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Task 1", listId });

    const res = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.board._id).toBe(boardId);
    expect(res.body.data.lists.length).toBe(1);
    expect(res.body.data.tasksByList[listId].length).toBe(1);
  });

  it("updates board title", async () => {
    const boardId = await createBoard(token);
    const res = await request(app)
      .put(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated Title" });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Updated Title");
  });

  it("deletes board and cascades", async () => {
    const boardId = await createBoard(token);
    await request(app)
      .delete(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`);
    const res = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe("Members", () => {
  let ownerToken: string;
  let boardId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Workspace.deleteMany({});
    await Board.deleteMany({});
    ownerToken = await signupAndToken("owner@example.com");
    boardId = await createBoard(ownerToken);
  });

  it("adds a member", async () => {
    const userRes = await request(app)
      .post("/api/auth/signup")
      .send({ email: "member@example.com", password: "password123", name: "Member" });
    expect(userRes.status).toBe(201);
    const userId = userRes.body.data.user._id;

    const res = await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId, role: "editor" });
    expect(res.status).toBe(200);
    expect(res.body.data.members.length).toBe(2);
  });

  it("removes a member", async () => {
    const userRes = await request(app)
      .post("/api/auth/signup")
      .send({ email: "removeme@example.com", password: "password123", name: "Remove Me" });
    expect(userRes.status).toBe(201);
    const userId = userRes.body.data.user._id;

    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId });

    const res = await request(app)
      .delete(`/api/boards/${boardId}/members/${userId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.members.length).toBe(1);
  });

  it("changes member role", async () => {
    const userRes = await request(app)
      .post("/api/auth/signup")
      .send({ email: "changerole@example.com", password: "password123", name: "Change Role" });
    expect(userRes.status).toBe(201);
    const userId = userRes.body.data.user._id;

    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId, role: "viewer" });

    const res = await request(app)
      .put(`/api/boards/${boardId}/members/${userId}/role`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "editor" });
    expect(res.status).toBe(200);
    const member = res.body.data.members.find((m: any) => m.user === userId);
    expect(member.role).toBe("editor");
  });
});

describe("Lists & Tasks", () => {
  let token: string;
  let boardId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Workspace.deleteMany({});
    await Board.deleteMany({});
    await List.deleteMany({});
    await Task.deleteMany({});
    token = await signupAndToken("lists@example.com");
    boardId = await createBoard(token);
  });

  it("creates and lists lists", async () => {
    await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "To Do" });
    await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Done" });

    const getRes = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getRes.body.data.lists.length).toBe(2);
  });

  it("creates a task and assigns it", async () => {
    const listRes = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "To Do" });
    expect(listRes.status).toBe(201);
    const listId = listRes.body.data._id;

    const res = await request(app)
      .post(`/api/boards/${boardId}/tasks`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "My Task", listId, priority: "high" });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("My Task");
    expect(res.body.data.priority).toBe("high");
  });

  it("moves a task between lists", async () => {
    const listARes = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "A" });
    const listBRes = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "B" });

    const taskRes = await request(app)
      .post(`/api/boards/${boardId}/tasks`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Move Me", listId: listARes.body.data._id });
    const taskId = taskRes.body.data._id;

    const moveRes = await request(app)
      .put(`/api/boards/${boardId}/tasks/${taskId}/move`)
      .set("Authorization", `Bearer ${token}`)
      .send({ targetListId: listBRes.body.data._id, position: 0 });
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.data.list).toBe(listBRes.body.data._id);
  });

  it("deletes a task", async () => {
    const listRes = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "To Do" });

    const taskRes = await request(app)
      .post(`/api/boards/${boardId}/tasks`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Delete Me", listId: listRes.body.data._id });

    const delRes = await request(app)
      .delete(`/api/boards/${boardId}/tasks/${taskRes.body.data._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(delRes.status).toBe(200);
  });

  it("reorders lists", async () => {
    const resA = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "A" });
    const resB = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "B" });

    const reorderRes = await request(app)
      .post(`/api/boards/${boardId}/lists/reorder`)
      .set("Authorization", `Bearer ${token}`)
      .send({ orders: [{ listId: resB.body.data._id, position: 0 }, { listId: resA.body.data._id, position: 1 }] });
    expect(reorderRes.status).toBe(200);
  });
});

describe("Permissions", () => {
  let ownerToken: string;
  let editorToken: string;
  let viewerToken: string;
  let outsiderToken: string;
  let boardId: string;

  async function userIdOf(token: string): Promise<string> {
    return (jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }).userId;
  }

  beforeEach(async () => {
    await User.deleteMany({});
    await Workspace.deleteMany({});
    await Board.deleteMany({});
    await List.deleteMany({});
    await Task.deleteMany({});

    ownerToken = await signupAndToken("perm-owner@example.com");
    editorToken = await signupAndToken("perm-editor@example.com");
    viewerToken = await signupAndToken("perm-viewer@example.com");
    outsiderToken = await signupAndToken("perm-outsider@example.com");
    boardId = await createBoard(ownerToken);

    for (const [token, role] of [[editorToken, "editor"], [viewerToken, "viewer"]] as const) {
      const res = await request(app)
        .post(`/api/boards/${boardId}/members`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ userId: await userIdOf(token), role });
      expect(res.status).toBe(200);
    }
  });

  it("lets an editor read the board (roles are a hierarchy)", async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${editorToken}`);
    expect(res.status).toBe(200);
  });

  it("lets a viewer read but not write", async () => {
    const read = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(read.status).toBe(200);

    const write = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ title: "Nope" });
    expect(write.status).toBe(403);
  });

  it("keeps non-members out entirely", async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it("refuses to create a board in someone else's workspace", async () => {
    const workspace = await workspaceFor(ownerToken);
    const res = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ title: "Sneaky", workspace });
    expect(res.status).toBe(403);
  });

  it("rejects unknown fields on task update", async () => {
    const listRes = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "To Do" });
    const taskRes = await request(app)
      .post(`/api/boards/${boardId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Guard Me", listId: listRes.body.data._id });

    const res = await request(app)
      .put(`/api/boards/${boardId}/tasks/${taskRes.body.data._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Renamed", board: "000000000000000000000000", createdBy: "000000000000000000000000" });
    expect(res.status).toBe(200);
    expect(res.body.data.board).toBe(boardId);
  });

  it("stamps completedAt when a task is marked done and clears it after", async () => {
    const listRes = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "To Do" });
    const taskRes = await request(app)
      .post(`/api/boards/${boardId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Finish Me", listId: listRes.body.data._id });
    const taskId = taskRes.body.data._id;

    const done = await request(app)
      .put(`/api/boards/${boardId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "done" });
    expect(done.body.data.completedAt).toBeTruthy();

    const reopened = await request(app)
      .put(`/api/boards/${boardId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "todo" });
    expect(reopened.body.data.completedAt).toBeFalsy();
  });
});

describe("Activity & Users", () => {
  let token: string;
  let boardId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Workspace.deleteMany({});
    await Board.deleteMany({});
    await List.deleteMany({});
    await Task.deleteMany({});
    await ActivityLog.deleteMany({});
    token = await signupAndToken("activity@example.com");
    boardId = await createBoard(token);
  });

  it("logs activity on board create", async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}/activity`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].action).toBe("board.created");
  });

  it("logs activity on task create", async () => {
    const listRes = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "To Do" });

    await request(app)
      .post(`/api/boards/${boardId}/tasks`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Log Me", listId: listRes.body.data._id });

    const actRes = await request(app)
      .get(`/api/boards/${boardId}/activity`)
      .set("Authorization", `Bearer ${token}`);
    const actions = actRes.body.data.map((l: any) => l.action);
    expect(actions).toContain("task.created");
  });

  it("searches users by email", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "searchme@example.com", password: "password123", name: "Search Me" });

    const res = await request(app)
      .get("/api/users/search?q=searchme")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].email).toBe("searchme@example.com");
  });
});
