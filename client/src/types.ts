export interface User {
  _id: string;
  email: string;
  name: string;
  avatar?: string;
  role: "admin" | "user";
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceRole = "admin" | "member" | "guest";

export interface WorkspaceMember {
  user: string | User;
  role: WorkspaceRole;
}

export interface Workspace {
  _id: string;
  name: string;
  slug: string;
  owner: string | User;
  members: WorkspaceMember[];
  settings: {
    defaultBoardTemplate?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BoardMember {
  user: string | User;
  role: "owner" | "editor" | "viewer";
  joinedAt: string;
}

export interface CustomField {
  name: string;
  type: "text" | "number" | "date" | "select" | "multiselect" | "checkbox";
  options?: string[];
  required?: boolean;
}

export interface Board {
  _id: string;
  title: string;
  description?: string;
  workspace: string | Workspace;
  owner: string | User;
  members: BoardMember[];
  customFields?: CustomField[];
  visibility?: "workspace" | "private";
  createdAt: string;
  updatedAt: string;
}

/** Mirrors the fields the API accepts on PUT /boards/:boardId. */
export interface BoardUpdate {
  title?: string;
  description?: string;
  visibility?: "workspace" | "private";
  customFields?: CustomField[];
}

export interface List {
  _id: string;
  title: string;
  board: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  _id: string;
  text: string;
  done: boolean;
  position: number;
}

export interface TaskDependency {
  task: string | Task;
  type: "blocks" | "blocked_by";
}

export interface Task {
  _id: string;
  title: string;
  description: string;
  list: string;
  board: string;
  position: number;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "done";
  assignees: (string | User)[];
  dueDate?: string;
  tags: string[];
  checklist: ChecklistItem[];
  coverImage?: string;
  customFieldValues?: Record<string, any>;
  dependencies?: TaskDependency[];
  createdBy: string | User;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors the fields the API accepts on PUT /boards/:boardId/tasks/:taskId. */
export interface TaskUpdate {
  title?: string;
  description?: string;
  listId?: string;
  position?: number;
  priority?: Task["priority"];
  status?: Task["status"];
  assignees?: string[];
  dueDate?: string | null;
  tags?: string[];
  coverImage?: string | null;
  customFieldValues?: Record<string, unknown>;
  dependencies?: { task: string; type: "blocks" | "blocked_by" }[];
}

export interface Comment {
  _id: string;
  task: string;
  board: string;
  author: string | User;
  body: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  _id: string;
  task: string;
  board: string;
  uploader: string | User;
  filename: string;
  url: string;
  publicId: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ActivityLogItem {
  _id: string;
  action: string;
  board: string;
  list?: string;
  task?: string;
  user: string | User;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface AnalyticsData {
  totalTasks: number;
  completionRate: number;
  tasksByStatus: {
    todo: number;
    in_progress: number;
    done: number;
  };
  tasksByPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  tasksByAssignee: Array<{
    name: string;
    count: number;
    userId: string;
  }>;
  velocity: Array<{
    date: string;
    count: number;
  }>;
}
