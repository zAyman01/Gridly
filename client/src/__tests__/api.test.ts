import { describe, it, expect, vi, beforeEach } from "vitest";
import { authApi, boardsApi } from "../api";

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  global.fetch = vi.fn();
});

describe("authApi", () => {
  it("authApi.login calls fetch with correct args", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { accessToken: "tok", user: { _id: "1", email: "a@b.com", name: "A" } } }),
    });
    const res = await authApi.login({ email: "a@b.com", password: "p" });
    expect(res.accessToken).toBe("tok");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "a@b.com", password: "p" }),
      })
    );
  });
});

describe("boardsApi", () => {
  beforeEach(() => {
    localStorage.setItem("gridly_accessToken", "test-token");
  });

  it("boardsApi.list sends auth header", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });
    await boardsApi.list();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/boards",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
  });

  it("boardsApi.create sends body", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { _id: "1", title: "New Board" } }),
    });
    const res = await boardsApi.create({ title: "New Board", workspace: "ws1" });
    expect(res.title).toBe("New Board");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/boards",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "New Board", workspace: "ws1" }),
      })
    );
  });

  it("throws on error response", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Bad request" } }),
    });
    await expect(boardsApi.list()).rejects.toThrow("Bad request");
  });
});
