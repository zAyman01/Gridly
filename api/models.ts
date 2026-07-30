import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

// ─── User ─────────────────────────────────────────────────────

export interface IUser extends Document {
  email: string; password: string; name: string; avatar?: string;
  refreshToken?: string; role: "admin" | "user";
  comparePassword(candidate: string): Promise<boolean>;
  createdAt: Date; updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, minlength: 8, select: false },
    name: { type: String, required: true, trim: true },
    avatar: { type: String },
    refreshToken: { type: String, select: false },
    role: { type: String, enum: ["admin", "user"], default: "user" },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    delete ret.password;
    delete ret.refreshToken;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model<IUser>("User", userSchema);

// ─── Workspace ────────────────────────────────────────────────

export interface IWorkspace extends Document {
  name: string;
  slug: string;
  owner: mongoose.Types.ObjectId;
  members: { user: mongoose.Types.ObjectId; role: "admin" | "member" | "guest" }[];
  settings: {
    defaultBoardTemplate?: mongoose.Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    members: [{
      user: { type: Schema.Types.ObjectId, ref: "User", required: true },
      role: { type: String, enum: ["admin", "member", "guest"], default: "member" },
      _id: false
    }],
    settings: {
      defaultBoardTemplate: { type: Schema.Types.ObjectId, ref: "BoardTemplate" }
    }
  },
  { timestamps: true }
);

workspaceSchema.index({ "members.user": 1 });
export const Workspace = mongoose.model<IWorkspace>("Workspace", workspaceSchema);

// ─── BoardTemplate ────────────────────────────────────────────

export interface IBoardTemplate extends Document {
  workspace: mongoose.Types.ObjectId;
  name: string;
  lists: { title: string; position: number }[];
  customFields: { name: string; type: string; options?: string[]; required?: boolean }[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const boardTemplateSchema = new Schema<IBoardTemplate>(
  {
    workspace: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true },
    lists: [{
      title: { type: String, required: true },
      position: { type: Number, default: 0 },
      _id: false
    }],
    customFields: [{
      name: { type: String, required: true },
      type: { type: String, enum: ["text", "number", "date", "select", "multiselect", "checkbox"], required: true },
      options: [{ type: String }],
      required: { type: Boolean, default: false },
      _id: false
    }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export const BoardTemplate = mongoose.model<IBoardTemplate>("BoardTemplate", boardTemplateSchema);

// ─── Board ────────────────────────────────────────────────────

export interface IBoard extends Document {
  title: string; description?: string;
  workspace: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  members: { user: mongoose.Types.ObjectId; role: "owner" | "editor" | "viewer"; joinedAt?: Date }[];
  customFields: { name: string; type: "text" | "number" | "date" | "select" | "multiselect" | "checkbox"; options?: string[]; required?: boolean }[];
  visibility: "workspace" | "private";
  createdAt: Date; updatedAt: Date;
}

const boardSchema = new Schema<IBoard>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    workspace: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    members: [{
      user: { type: Schema.Types.ObjectId, ref: "User", required: true },
      role: { type: String, enum: ["owner", "editor", "viewer"], default: "viewer" },
      joinedAt: { type: Date, default: Date.now },
      _id: false,
    }],
    customFields: [{
      name: { type: String, required: true },
      type: { type: String, enum: ["text", "number", "date", "select", "multiselect", "checkbox"], required: true },
      options: [{ type: String }],
      required: { type: Boolean, default: false },
      _id: false
    }],
    visibility: { type: String, enum: ["workspace", "private"], default: "workspace" }
  },
  { timestamps: true }
);

boardSchema.index({ "members.user": 1 });
export const Board = mongoose.model<IBoard>("Board", boardSchema);

// ─── List ─────────────────────────────────────────────────────

export interface IList extends Document {
  title: string; board: mongoose.Types.ObjectId; position: number;
  createdAt: Date; updatedAt: Date;
}

const listSchema = new Schema<IList>(
  {
    title: { type: String, required: true, trim: true },
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true, index: true },
    position: { type: Number, default: 0 },
  },
  { timestamps: true }
);
listSchema.index({ board: 1, position: 1 });
export const List = mongoose.model<IList>("List", listSchema);

// ─── Task ─────────────────────────────────────────────────────

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "done";

export interface IChecklistItem {
  text: string;
  done: boolean;
  position: number;
}

export interface ITask extends Document {
  title: string; description?: string;
  list: mongoose.Types.ObjectId; board: mongoose.Types.ObjectId;
  position: number; priority: TaskPriority; status: TaskStatus;
  assignees: mongoose.Types.ObjectId[]; dueDate?: Date; tags: string[];
  checklist: IChecklistItem[];
  coverImage?: string;
  customFieldValues: Map<string, any>;
  dependencies: { task: mongoose.Types.ObjectId; type: "blocks" | "blocked_by" }[];
  createdBy: mongoose.Types.ObjectId;
  completedAt?: Date;
  createdAt: Date; updatedAt: Date;
}

const checklistItemSchema = new Schema<IChecklistItem>(
  {
    text: { type: String, required: true, trim: true, maxlength: 500 },
    done: { type: Boolean, default: false },
    position: { type: Number, default: 0 },
  },
  { _id: true }
);

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 50000, default: "" },
    list: { type: Schema.Types.ObjectId, ref: "List", required: true, index: true },
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true, index: true },
    position: { type: Number, default: 0 },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    status: { type: String, enum: ["todo", "in_progress", "done"], default: "todo" },
    assignees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    dueDate: { type: Date },
    tags: [{ type: String, maxlength: 50 }],
    checklist: [checklistItemSchema],
    coverImage: { type: String },
    customFieldValues: { type: Map, of: Schema.Types.Mixed, default: {} },
    dependencies: [{
      task: { type: Schema.Types.ObjectId, ref: "Task", required: true },
      type: { type: String, enum: ["blocks", "blocked_by"], required: true },
      _id: false
    }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    completedAt: { type: Date },
  },
  { timestamps: true }
);
taskSchema.index({ board: 1, list: 1, position: 1 });
export const Task = mongoose.model<ITask>("Task", taskSchema);

// ─── Comment ──────────────────────────────────────────────────

export interface IComment extends Document {
  task: mongoose.Types.ObjectId;
  board: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  body: string;
  mentions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 10000 },
    mentions: [{ type: String }],
  },
  { timestamps: true }
);
commentSchema.index({ task: 1, createdAt: -1 });
export const Comment = mongoose.model<IComment>("Comment", commentSchema);

// ─── Attachment ───────────────────────────────────────────────

export interface IAttachment extends Document {
  task: mongoose.Types.ObjectId;
  board: mongoose.Types.ObjectId;
  uploader: mongoose.Types.ObjectId;
  filename: string;
  url: string;
  publicId: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true, index: true },
    uploader: { type: Schema.Types.ObjectId, ref: "User", required: true },
    filename: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
attachmentSchema.index({ task: 1, createdAt: -1 });
export const Attachment = mongoose.model<IAttachment>("Attachment", attachmentSchema);

// ─── ActivityLog ──────────────────────────────────────────────

export interface IActivityLog extends Document {
  action: string; board: mongoose.Types.ObjectId;
  list?: mongoose.Types.ObjectId; task?: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId; details?: Record<string, unknown>;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    action: { type: String, required: true, maxlength: 100 },
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true, index: true },
    list: { type: Schema.Types.ObjectId, ref: "List" },
    task: { type: Schema.Types.ObjectId, ref: "Task" },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
export const ActivityLog = mongoose.model<IActivityLog>("ActivityLog", activityLogSchema);
