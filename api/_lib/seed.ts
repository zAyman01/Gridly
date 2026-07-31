import mongoose from "mongoose";
import { connectDB } from "./db";
import { User, Workspace, Board, List, Task, Comment, ActivityLog } from "./models";

async function seed() {
  console.log("🌱 Connecting to MongoDB...");
  await connectDB();
  console.log("✅ Connected to MongoDB.");

  const seedEmails = ["demo@gridly.app", "sarah@gridly.app", "alex@gridly.app"];
  const seedSlugs = ["acme-corp", "design-system-studio", "demo-acme-corp", "demo-design-studio"];

  console.log("🧹 Cleaning up old demo seed data...");
  const existingUsers = await User.find({ email: { $in: seedEmails } });
  const existingUserIds = existingUsers.map((u) => u._id);

  const existingWorkspaces = await Workspace.find({
    $or: [{ owner: { $in: existingUserIds } }, { slug: { $in: seedSlugs } }],
  });
  const wsIds = existingWorkspaces.map((w) => w._id);
  const existingBoards = await Board.find({ workspace: { $in: wsIds } });
  const boardIds = existingBoards.map((b) => b._id);

  if (boardIds.length > 0) {
    await ActivityLog.deleteMany({ board: { $in: boardIds } });
    await Comment.deleteMany({ board: { $in: boardIds } });
    await Task.deleteMany({ board: { $in: boardIds } });
    await List.deleteMany({ board: { $in: boardIds } });
    await Board.deleteMany({ _id: { $in: boardIds } });
  }

  if (wsIds.length > 0) {
    await Workspace.deleteMany({ _id: { $in: wsIds } });
  }

  if (existingUserIds.length > 0) {
    await User.deleteMany({ _id: { $in: existingUserIds } });
  }

  console.log("👤 Creating demo users...");
  const demoUser = await User.create({
    email: "demo@gridly.app",
    password: "password123",
    name: "Demo User",
    role: "admin",
  });

  const sarahUser = await User.create({
    email: "sarah@gridly.app",
    password: "password123",
    name: "Sarah Chen",
    role: "user",
  });

  const alexUser = await User.create({
    email: "alex@gridly.app",
    password: "password123",
    name: "Alex Rivera",
    role: "user",
  });

  console.log("🏢 Creating workspaces...");
  const acmeWorkspace = await Workspace.create({
    name: "Acme Corp",
    slug: "demo-acme-corp",
    owner: demoUser._id,
    members: [
      { user: demoUser._id, role: "admin" },
      { user: sarahUser._id, role: "member" },
      { user: alexUser._id, role: "member" },
    ],
  });

  const designWorkspace = await Workspace.create({
    name: "Design System Studio",
    slug: "demo-design-studio",
    owner: demoUser._id,
    members: [
      { user: demoUser._id, role: "admin" },
      { user: sarahUser._id, role: "member" },
    ],
  });

  console.log("📋 Creating boards and lists for Acme Corp...");
  const roadmapBoard = await Board.create({
    title: "Q3 Product Roadmap",
    description: "High-level strategic roadmap for engineering and product design in Q3.",
    workspace: acmeWorkspace._id,
    owner: demoUser._id,
    members: [
      { user: demoUser._id, role: "owner" },
      { user: sarahUser._id, role: "editor" },
      { user: alexUser._id, role: "editor" },
    ],
    visibility: "workspace",
  });

  const sprintBoard = await Board.create({
    title: "Engineering Sprint 42",
    description: "Active engineering sprint tasks and bug fixes.",
    workspace: acmeWorkspace._id,
    owner: demoUser._id,
    members: [
      { user: demoUser._id, role: "owner" },
      { user: sarahUser._id, role: "editor" },
      { user: alexUser._id, role: "editor" },
    ],
    visibility: "workspace",
  });

  // Roadmap Lists
  const listBacklog = await List.create({ title: "Backlog", board: roadmapBoard._id, position: 0 });
  const listInProgress = await List.create({ title: "In Progress", board: roadmapBoard._id, position: 1 });
  const listUnderReview = await List.create({ title: "Under Review", board: roadmapBoard._id, position: 2 });
  const listDone = await List.create({ title: "Done", board: roadmapBoard._id, position: 3 });

  // Sprint Lists
  const sprintTodo = await List.create({ title: "Todo", board: sprintBoard._id, position: 0 });
  const sprintDoing = await List.create({ title: "Doing", board: sprintBoard._id, position: 1 });
  const sprintDeployed = await List.create({ title: "Deployed", board: sprintBoard._id, position: 2 });

  console.log("📌 Seeding tasks into Q3 Product Roadmap...");
  await Task.create([
    {
      title: "Implement Slack Notifications Webhook",
      description: "We need a webhook handler in Express to push board activity logs to a dedicated Slack channel.",
      list: listBacklog._id,
      board: roadmapBoard._id,
      position: 0,
      priority: "high",
      status: "todo",
      tags: ["backend", "integration", "slack"],
      assignees: [sarahUser._id],
      createdBy: demoUser._id,
      checklist: [
        { text: "Define Slack webhook payload schema", done: true, position: 0 },
        { text: "Implement POST endpoint /api/webhooks/slack", done: false, position: 1 },
        { text: "Add UI toggle in Board Settings", done: false, position: 2 },
      ],
    },
    {
      title: "Customer Feedback Analytics Widget",
      description: "Embed NPS score and customer ticket volume directly inside the workspace dashboard.",
      list: listBacklog._id,
      board: roadmapBoard._id,
      position: 1,
      priority: "medium",
      status: "todo",
      tags: ["frontend", "analytics"],
      assignees: [alexUser._id],
      createdBy: demoUser._id,
    },
    {
      title: "Global Command Palette (Cmd+K)",
      description: "Global keyboard-first navigation across Workspaces and Boards. Press Cmd+K or Ctrl+K anywhere to jump between boards or execute system actions.",
      list: listInProgress._id,
      board: roadmapBoard._id,
      position: 0,
      priority: "urgent",
      status: "in_progress",
      tags: ["frontend", "ux", "roadmap"],
      assignees: [demoUser._id, sarahUser._id],
      createdBy: demoUser._id,
      checklist: [
        { text: "Design Signal Line industrial theme modal", done: true, position: 0 },
        { text: "Bind window keyboard shortcuts (Cmd+K / Ctrl+K)", done: true, position: 1 },
        { text: "Add instant search filtering for boards and workspaces", done: true, position: 2 },
        { text: "Gather user feedback on mobile touch target sizing", done: false, position: 3 },
      ],
    },
    {
      title: "Tailwind v4 Migration & Industrial Enamel Tokens",
      description: "Enforce the Signal Line machine-enamel industrial color palette across all client views.",
      list: listInProgress._id,
      board: roadmapBoard._id,
      position: 1,
      priority: "high",
      status: "in_progress",
      tags: ["css", "design-system"],
      assignees: [demoUser._id],
      createdBy: demoUser._id,
    },
    {
      title: "Socket.IO Polling Fallback for Vercel Serverless",
      description: "Since Vercel Serverless Functions do not support long-lived WebSocket connections, automatically detect disconnects and fallback to 3s REST polling.",
      list: listUnderReview._id,
      board: roadmapBoard._id,
      position: 0,
      priority: "high",
      status: "todo",
      tags: ["infrastructure", "realtime"],
      assignees: [alexUser._id, sarahUser._id],
      createdBy: demoUser._id,
      checklist: [
        { text: "Implement usePollingFallback custom hook", done: true, position: 0 },
        { text: "Verify with 55 unit tests", done: true, position: 1 },
      ],
    },
    {
      title: "Automated Ship Gate Audit CLI",
      description: "Pre-production audit framework checking 8 categories: SEC, DB, DEPLOY, CODE, AI, DEP, FE, OBS.",
      list: listDone._id,
      board: roadmapBoard._id,
      position: 0,
      priority: "urgent",
      status: "done",
      tags: ["security", "devops", "ship-gate"],
      assignees: [demoUser._id],
      createdBy: demoUser._id,
      completedAt: new Date(Date.now() - 3600 * 1000 * 24),
    },
  ]);

  console.log("📌 Seeding tasks into Engineering Sprint 42...");
  await Task.create([
    {
      title: "Optimize MongoDB Atlas SRV connection caching",
      description: "Ensure global mongoose cache survives Vercel serverless cold starts.",
      list: sprintTodo._id,
      board: sprintBoard._id,
      position: 0,
      priority: "high",
      status: "todo",
      assignees: [sarahUser._id],
      createdBy: demoUser._id,
    },
    {
      title: "Lazy load Chart.js and Analytics Dashboard bundles",
      description: "Reduce initial JS bundle payload by splitting analytics routes.",
      list: sprintDoing._id,
      board: sprintBoard._id,
      position: 0,
      priority: "medium",
      status: "in_progress",
      assignees: [alexUser._id],
      createdBy: demoUser._id,
    },
    {
      title: "Fix avatar stack rendering in header bar",
      description: "Ensure initials display cleanly on small screens.",
      list: sprintDeployed._id,
      board: sprintBoard._id,
      position: 0,
      priority: "low",
      status: "done",
      assignees: [demoUser._id],
      createdBy: demoUser._id,
      completedAt: new Date(Date.now() - 3600 * 1000 * 48),
    },
  ]);

  console.log("🎨 Seeding Design System Studio workspace...");
  const dsBoard = await Board.create({
    title: "Signal Line Component Kit",
    description: "UI pattern library and design token definitions.",
    workspace: designWorkspace._id,
    owner: demoUser._id,
    members: [
      { user: demoUser._id, role: "owner" },
      { user: sarahUser._id, role: "editor" },
    ],
    visibility: "workspace",
  });

  const dsTokens = await List.create({ title: "Tokens", board: dsBoard._id, position: 0 });
  const dsComponents = await List.create({ title: "Components", board: dsBoard._id, position: 1 });
  const dsDocs = await List.create({ title: "Documentation", board: dsBoard._id, position: 2 });

  await Task.create([
    {
      title: "Audit Industrial Machine Enamel palette (#e4e7e1)",
      list: dsTokens._id,
      board: dsBoard._id,
      position: 0,
      priority: "high",
      status: "todo",
      assignees: [demoUser._id],
      createdBy: demoUser._id,
    },
    {
      title: "Glassmorphic Command Palette Overlay",
      list: dsComponents._id,
      board: dsBoard._id,
      position: 0,
      priority: "medium",
      status: "in_progress",
      assignees: [sarahUser._id],
      createdBy: demoUser._id,
    },
    {
      title: "Kanban Board Work-Order Slips",
      list: dsComponents._id,
      board: dsBoard._id,
      position: 1,
      priority: "medium",
      status: "done",
      assignees: [demoUser._id],
      createdBy: demoUser._id,
    },
    {
      title: "Publish Signal Line Design System guide",
      list: dsDocs._id,
      board: dsBoard._id,
      position: 0,
      priority: "low",
      status: "todo",
      assignees: [sarahUser._id],
      createdBy: demoUser._id,
    },
  ]);

  await ActivityLog.create([
    {
      action: "created board Q3 Product Roadmap",
      board: roadmapBoard._id,
      user: demoUser._id,
    },
    {
      action: "added task 'Global Command Palette (Cmd+K)'",
      board: roadmapBoard._id,
      list: listInProgress._id,
      user: demoUser._id,
    },
    {
      action: "moved task 'Automated Ship Gate Audit CLI' to Done",
      board: roadmapBoard._id,
      list: listDone._id,
      user: demoUser._id,
    },
  ]);

  console.log("✨ Seed completed successfully!");
  console.log("-----------------------------------------");
  console.log("Demo User Credentials:");
  console.log("  Email:    demo@gridly.app");
  console.log("  Password: password123");
  console.log("-----------------------------------------");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
