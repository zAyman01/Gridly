# Gridly Docs

Collaborative, intelligent project management system — monorepo with Express API + React SPA.

## Quick links

| Doc | What |
|-----|------|
| [Architecture](architecture.md) | Stack, structure, data flow |
| [API Reference](api.md) | Endpoints, auth, models |
| [Frontend](frontend.md) | Components, design system, build |
| [Roadmap](roadmap.md) | Project phases and progress |
| [Deployment](deployment.md) | Vercel, env vars, production |

## Features Overview

Gridly goes beyond a simple Kanban board, offering advanced tools for team productivity:

1. **Workspaces & Boards:** Group your boards logically under Workspaces. You can have multiple boards per workspace, each with its own members and settings.
2. **Advanced Views:** Not just Kanban. Switch effortlessly between **Board (Kanban)**, **Table**, **Calendar**, and **Timeline** views to visualize your data how you prefer.
3. **Rich Task Content:** 
   - Write robust descriptions using **Markdown**.
   - Manage progress with advanced **Checklists**.
   - Define custom data with **Custom Fields**.
   - Model execution order with **Task Dependencies** (blocks/blocked by).
4. **Analytics & Reporting:** Built-in charts (using Recharts) to track your team's velocity, workload distribution by assignee, and task status breakdown.
5. **AI Integration (Gemini):**
   - **Auto-generate Steps:** Instantly break down a complex task into actionable checklist items.
   - **Draft Descriptions:** Generate a professional, concise description for any task based on its title.

## Project layout

```
gridly/
├── api/                  # Express API server
│   ├── aiRoutes.ts       # Gemini AI integration endpoints
│   ├── analyticsRoutes.ts# Aggregation endpoints for charts
│   ├── workspaceRoutes.ts# Workspace CRUD handlers
│   ├── config.ts         # Env config
│   ├── db.ts             # MongoDB connection (cached)
│   ├── models.ts         # Mongoose models (User, Workspace, Board, List, Task, etc.)
│   ├── middleware.ts     # Auth, validation, error handler
│   ├── routes.ts         # Standard route handlers
│   ├── utils.ts          # JWT, types, ApiError
│   └── index.ts          # Express app + Vercel handler
├── client/               # Vite + React 19 SPA
│   └── src/
│       ├── api.ts        # API client
│       ├── auth.tsx      # Auth context + provider
│       ├── socket.ts     # WebSocket client
│       ├── types.ts      # Shared types
│       ├── globals.css   # Tailwind v4 + design tokens
│       ├── App.tsx       # Router
│       ├── main.tsx      # Entry
│       ├── components/   # Reusable UI (TaskDetailModal, AnalyticsDashboard, etc.)
│       └── pages/        # Route pages (WorkspacePage, BoardViewPage, etc.)
│           └── views/    # Kanban, Table, Calendar, Timeline views
├── docs/                 # This directory
├── .env.example          # Env template
├── vercel.json
└── package.json
```
