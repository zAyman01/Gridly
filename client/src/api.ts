import type { Workspace, WorkspaceRole, Board, BoardUpdate, List, Task, TaskUpdate, User, ActivityLogItem, Comment, Attachment, ChecklistItem, AnalyticsData } from "./types";

const BASE = "/api";

let refreshPromise: Promise<string | null> | null = null;

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const getToken = () => localStorage.getItem("gridly_accessToken");
  let token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...((options.headers as Record<string, string>) || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: "include" });

  if (res.status === 401 && path !== "/auth/refresh" && path !== "/auth/login" && path !== "/auth/signup") {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const data = await request<{ accessToken: string }>("/auth/refresh", { method: "POST" });
          localStorage.setItem("gridly_accessToken", data.accessToken);
          return data.accessToken;
        } catch {
          localStorage.removeItem("gridly_accessToken");
          return null;
        } finally {
          refreshPromise = null;
        }
      })();
    }
    const newToken = await refreshPromise;
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      const retry = await fetch(`${BASE}${path}`, { ...options, headers, credentials: "include" });
      if (!retry.ok) {
        const body = await retry.json().catch(() => ({}));
        throw new Error(body?.error?.message || `Request failed (${retry.status})`);
      }
      const retryBody = await retry.json();
      return retryBody.data as T;
    }
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Request failed (${res.status})`);
  }

  const body = await res.json();
  return body.data as T;
}

/** Upload a file via multipart form data (skips JSON Content-Type) */
async function uploadRequest<T = unknown>(path: string, formData: FormData): Promise<T> {
  const token = localStorage.getItem("gridly_accessToken");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Do NOT set Content-Type — browser sets it with multipart boundary

  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: formData, credentials: "include" });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Upload failed (${res.status})`);
  }

  const body = await res.json();
  return body.data as T;
}

export const authApi = {
  signup: (data: { email: string; password: string; name: string }) => request<{ user: unknown; accessToken: string }>("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) => request<{ user: unknown; accessToken: string }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  refresh: () => request<{ accessToken: string }>("/auth/refresh", { method: "POST" }),
  logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
};

export const boardsApi = {
  list: (workspaceId?: string) => request<Board[]>(workspaceId ? `/boards?workspace=${workspaceId}` : `/boards`),
  getDetail: (id: string) => request<{ board: Board; lists: List[]; tasksByList: Record<string, Task[]> }>(`/boards/${id}`),
  create: (data: { title: string; description?: string; workspace: string }) => request<Board>("/boards", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: BoardUpdate) => request<Board>(`/boards/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request(`/boards/${id}`, { method: "DELETE" }),
};

export const listsApi = {
  create: (boardId: string, data: { title: string }) => request<List>(`/boards/${boardId}/lists`, { method: "POST", body: JSON.stringify(data) }),
  update: (boardId: string, listId: string, data: { title?: string; position?: number }) =>
    request<List>(`/boards/${boardId}/lists/${listId}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (boardId: string, listId: string) =>
    request(`/boards/${boardId}/lists/${listId}`, { method: "DELETE" }),
  reorder: (boardId: string, orders: { listId: string; position: number }[]) =>
    request(`/boards/${boardId}/lists/reorder`, { method: "POST", body: JSON.stringify({ orders }) }),
};

export const tasksApi = {
  create: (boardId: string, data: { title: string; listId?: string; priority?: string; description?: string; assignees?: string[]; tags?: string[]; dueDate?: string }) =>
    request<Task>(`/boards/${boardId}/tasks`, { method: "POST", body: JSON.stringify(data) }),
  update: (boardId: string, taskId: string, data: TaskUpdate) =>
    request<Task>(`/boards/${boardId}/tasks/${taskId}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (boardId: string, taskId: string) =>
    request(`/boards/${boardId}/tasks/${taskId}`, { method: "DELETE" }),
  move: (boardId: string, taskId: string, data: { targetListId: string; position: number }) =>
    request<Task>(`/boards/${boardId}/tasks/${taskId}/move`, { method: "PUT", body: JSON.stringify(data) }),
};

export const commentsApi = {
  list: (boardId: string, taskId: string) =>
    request<Comment[]>(`/boards/${boardId}/tasks/${taskId}/comments`),
  create: (boardId: string, taskId: string, data: { body: string; mentions?: string[] }) =>
    request<Comment>(`/boards/${boardId}/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify(data) }),
  update: (boardId: string, taskId: string, commentId: string, data: { body: string }) =>
    request<Comment>(`/boards/${boardId}/tasks/${taskId}/comments/${commentId}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (boardId: string, taskId: string, commentId: string) =>
    request(`/boards/${boardId}/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" }),
};

export const checklistApi = {
  add: (boardId: string, taskId: string, data: { text: string }) =>
    request<ChecklistItem[]>(`/boards/${boardId}/tasks/${taskId}/checklist`, { method: "POST", body: JSON.stringify(data) }),
  toggle: (boardId: string, taskId: string, itemId: string, done: boolean) =>
    request<ChecklistItem[]>(`/boards/${boardId}/tasks/${taskId}/checklist/${itemId}`, { method: "PUT", body: JSON.stringify({ done }) }),
  remove: (boardId: string, taskId: string, itemId: string) =>
    request<ChecklistItem[]>(`/boards/${boardId}/tasks/${taskId}/checklist/${itemId}`, { method: "DELETE" }),
  reorder: (boardId: string, taskId: string, orders: { itemId: string; position: number }[]) =>
    request<ChecklistItem[]>(`/boards/${boardId}/tasks/${taskId}/checklist/reorder`, { method: "POST", body: JSON.stringify({ orders }) }),
};

export const attachmentsApi = {
  list: (boardId: string, taskId: string) =>
    request<Attachment[]>(`/boards/${boardId}/tasks/${taskId}/attachments`),
  upload: (boardId: string, taskId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadRequest<Attachment>(`/boards/${boardId}/tasks/${taskId}/attachments`, formData);
  },
  delete: (boardId: string, taskId: string, attachmentId: string) =>
    request(`/boards/${boardId}/tasks/${taskId}/attachments/${attachmentId}`, { method: "DELETE" }),
};

export const membersApi = {
  add: (boardId: string, userId: string, role?: string) =>
    request(`/boards/${boardId}/members`, { method: "POST", body: JSON.stringify({ userId, role }) }),
  remove: (boardId: string, userId: string) =>
    request(`/boards/${boardId}/members/${userId}`, { method: "DELETE" }),
  updateRole: (boardId: string, userId: string, role: string) =>
    request(`/boards/${boardId}/members/${userId}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
};

export const activityApi = {
  list: (boardId: string) => request<ActivityLogItem[]>(`/boards/${boardId}/activity`),
};

export const usersApi = {
  search: (q: string) => request<User[]>(`/users/search?q=${encodeURIComponent(q)}`),
};

export const workspaceApi = {
  list: () => request<Workspace[]>("/workspaces"),
  get: (slug: string) => request<{ workspace: Workspace; boards: Board[]; role: WorkspaceRole }>(`/workspaces/${slug}`),
  create: (data: { name: string; slug: string }) => request<Workspace>("/workspaces", { method: "POST", body: JSON.stringify(data) }),
  update: (slug: string, data: { name: string }) => request<Workspace>(`/workspaces/${slug}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (slug: string) => request(`/workspaces/${slug}`, { method: "DELETE" }),
  addMember: (slug: string, userId: string, role: WorkspaceRole = "member") =>
    request<Workspace>(`/workspaces/${slug}/members`, { method: "POST", body: JSON.stringify({ userId, role }) }),
  removeMember: (slug: string, userId: string) =>
    request<Workspace>(`/workspaces/${slug}/members/${userId}`, { method: "DELETE" }),
};

export const analyticsApi = {
  getWorkspaceAnalytics: (slug: string) => request<AnalyticsData>(`/analytics/workspace/${slug}`),
  getBoardAnalytics: (boardId: string) => request<AnalyticsData>(`/analytics/board/${boardId}`),
};

export const aiApi = {
  draftDescription: (boardId: string, taskId: string) =>
    request<string>(`/ai/boards/${boardId}/tasks/${taskId}/draft-description`, { method: "POST" }),
  breakdownTask: (boardId: string, taskId: string) =>
    request<ChecklistItem[]>(`/ai/boards/${boardId}/tasks/${taskId}/breakdown`, { method: "POST" }),
};
