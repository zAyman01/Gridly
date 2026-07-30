# Roadmap

Gridly is a collaborative, intelligent project management system (Express API + React 19 SPA, MongoDB).
The project was built in phases, all of which are now complete.

## Phase 0 & 1 — Foundation & Basic Features ✅ Done

- [x] Monorepo layout: `api/` (Express + TS) + `client/` (Vite + React 19 + Tailwind v4)
- [x] MongoDB connection, serverless-cached (`api/index.ts` handler + dev server)
- [x] Mongoose models: User, Board, List, Task
- [x] Auth: signup, login, logout, `me`
- [x] Boards: create, list, get detail, update, delete
- [x] Lists & Tasks CRUD
- [x] Dashboard page & Basic Kanban view

## Phase A — Rich Content ✅ Done

Enhanced the task model and detail modal to support complex workflows.

- [x] **Markdown Descriptions:** Fully rendered markdown editor in the task detail modal.
- [x] **Advanced Checklists:** Support for adding, toggling, and reordering checklist items on tasks.
- [x] **Custom Fields:** Dynamic key-value pairs assigned to tasks based on board schema.
- [x] **Task Dependencies:** Define relationships between tasks (blocks / blocked by).
- [x] **Cover Images & Attachments:** Add visual context to tasks via Cloudinary integration.

## Phase B — Workspaces & Navigation ✅ Done

Organized boards into a hierarchical structure.

- [x] **Workspace Model & Routes:** Create and manage workspaces, grouping boards logically.
- [x] **Workspace Dashboard:** Rebuilt `DashboardPage` to show available workspaces and recently active boards.
- [x] **Workspace Details Page:** New route `/w/:slug` listing all boards within that workspace.
- [x] **Navigation Updates:** Updated routing and breadcrumbs to support Workspace -> Board flow.

## Phase C — Advanced Views ✅ Done

Moved beyond simple Kanban to offer multiple ways to visualize data.

- [x] **Table View:** A data-dense spreadsheet-style list of tasks.
- [x] **Calendar View:** Visualize task due dates in a monthly grid.
- [x] **Timeline View:** A Gantt-style chart showing task durations and dependencies.
- [x] **View Switcher:** UI toggle in `BoardViewPage` to instantly switch between Kanban, Table, Calendar, and Timeline.

## Phase D — Analytics & Reporting ✅ Done

Added intelligent insights into productivity and workloads.

- [x] **Data Aggregation:** Backend endpoints to compute task statistics at the board and workspace levels.
- [x] **Velocity Tracking:** Added `completedAt` to the Task model to measure output over time.
- [x] **Analytics Dashboard UI:** Used `recharts` to build a visual dashboard displaying:
  - Task status breakdown (Donut chart).
  - Priority distribution (Bar chart).
  - Workload by assignee (Bar chart).
  - Completion velocity over 14 days (Line chart).
- [x] **Tab Integration:** Added an Analytics tab to `WorkspacePage` and an Analytics view to `BoardViewPage`.

## Phase E — AI Integration ✅ Done

Powered up Gridly with Generative AI via Google's Gemini models.

- [x] **Gemini SDK Setup:** Integrated `@google/generative-ai` securely on the backend.
- [x] **AI Task Breakdown:** "Auto-generate steps" button in the task checklist that asks Gemini to break a task down into actionable subtasks.
- [x] **AI Description Drafting:** "Draft with AI" button that auto-generates a professional markdown description based purely on the task's title.
- [x] **Secure Endpoints:** API key is fully shielded from the client browser.

## Phase F — Hardening ✅ Done

A full pass over the spec, fixing what did not match it.

- [x] **Role hierarchy:** `requireBoardRole()` now treats roles as a hierarchy, so editors and owners can read a board that only names `viewer`.
- [x] **Workspace guard:** boards can only be created inside a workspace the caller belongs to.
- [x] **AI endpoints secured:** moved under `/api/ai/boards/:boardId/tasks/:taskId/*` behind `requireBoardRole("editor")`, with their own rate limit and a clean 503 when no key is configured.
- [x] **Write whitelists:** task and board updates validate against zod schemas instead of `$set`-ing whatever arrives.
- [x] **Cascading deletes:** boards, lists, and tasks now take their comments, attachments (Cloudinary included), history, and inbound dependency links with them.
- [x] **Custom fields and dependencies in the UI:** defined in board settings, edited on the card, flagged on the board and the timeline.
- [x] **Uniform errors:** workspace and analytics routes answer in the standard `{ error: { code, message } }` shape.
- [x] **Tests:** permission hierarchy, workspace guard, update whitelist, and `completedAt` behaviour are covered.

## Next Steps

Gridly's core feature set is fully built out. Future updates may focus on:
- End-to-end coverage (Playwright) on top of the current unit and API tests.
- Live presence — cursors and "who is looking at this card".
- Advanced permission levels inside workspaces (guest scoping, per-board defaults).
- Board templates: the model exists, the UI does not.
