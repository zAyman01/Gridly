# Gridly — Agent Quickstart

> Monorepo: Express API + React 19 SPA. Collaborative project management — workspaces, boards, four views, analytics, and Gemini-backed drafting.

## Repo layout

```
gridly/
├── api/                    # Express 4 + TypeScript backend
│   ├── config.ts           # Env vars (dotenv)
│   ├── db.ts               # Mongoose connection (global cached)
│   ├── models.ts           # User, Workspace, BoardTemplate, Board, List, Task, Comment, Attachment, ActivityLog
│   ├── middleware.ts       # authenticate(), requireBoardRole(), validate(), errorHandler
│   ├── routes.ts           # Handlers + zod schemas (auth, board, list, task, comment, checklist, attachment)
│   ├── workspaceRoutes.ts  # Workspace CRUD + members
│   ├── analyticsRoutes.ts  # Aggregation for the dashboard
│   ├── aiRoutes.ts         # Gemini: draft description, task breakdown
│   ├── cloudinary.ts       # Upload/delete, isUploadConfigured()
│   ├── socket.ts           # Socket.IO rooms + emitBoardChange()
│   ├── utils.ts            # JWT sign/verify, ApiError class, types
│   ├── tests/              # vitest + mongodb-memory-server
│   ├── tsconfig.json       # Target ES2022, strict, bundler moduleResolution
│   └── index.ts            # Express app (all routes wired) + Vercel handler
├── client/                 # Vite 6 + React 19 + Tailwind v4 SPA
│   └── src/
│       ├── api.ts          # Generic fetch wrapper, typed API methods
│       ├── auth.tsx        # AuthProvider + useAuth hook
│       ├── socket.ts       # Socket.IO singleton (null when unavailable)
│       ├── types.ts        # Workspace, Board, List, Task, TaskUpdate, BoardUpdate, …
│       ├── App.tsx         # BrowserRouter + routes (app pages are lazy)
│       ├── globals.css     # Design tokens, shared classes, motion
│       ├── components/     # TaskDetailModal, BoardSettingsModal, AnalyticsDashboard, …
│       ├── hooks/          # useFocusTrap, usePollingFallback, useScrollReveal
│       └── pages/          # HomePage, Login, Signup, Dashboard, Workspace, BoardView
│           └── views/      # KanbanView, TableView, CalendarView, TimelineView
├── docs/                   # Documentation
├── agent.md                # ← You are here
├── .env.example
├── vercel.json             # Client build, SPA rewrites, API routes
└── package.json            # Workspace: client, scripts: dev/dev:api/dev:client/build/test
```

## Quick commands

```bash
npm run dev        # concurrently → API :4000 + Vite :5173
npm run dev:api    # tsx api/index.ts
npm run dev:client # cd client && vite
npm run build      # cd client && vite build
```

## Architecture

- **API**: Express 4, Mongoose 8, JWT (access + httpOnly refresh cookie), Zod validation, rate-limited (600 global / 20 auth / 30 AI per 15 min)
- **Client**: React 19, Vite 6, Tailwind v4 (`@theme` in CSS), React Router 8 (import from `react-router`, not `react-router-dom`), Socket.IO, Recharts
- **Auth**: `localStorage` stores accessToken; refresh cookie rotates on every refresh
- **Perms**: board roles are a hierarchy `owner ⊃ editor ⊃ viewer`, enforced by `requireBoardRole()`; workspaces carry `admin | member | guest`
- **DB**: MongoDB — User, Workspace, Board (members[]), List, Task, Comment, Attachment, ActivityLog
- **WebSocket**: Socket.IO rooms per boardId; where sockets are unavailable the client polls (`usePollingFallback`)
- **AI**: `/api/ai/boards/:boardId/tasks/:taskId/*`, guarded by `requireBoardRole("editor")`; key stays server-side

## Key design decisions

1. **Flat `api/` dir** — Vercel serverless entry at `api/index.ts` exports `handler(req, res)` with lazy mongoose connect
2. **`global.mongooseCache`** — cached connection across serverless invocations (warm starts)
3. **Tailwind v4** — no `tailwind.config`, all tokens in CSS `@theme` via `@tailwindcss/vite` plugin
4. **Error handler** — `ApiError` class with `.badRequest()/.unauthorized()/.forbidden()/.notFound()/.conflict()` static factories; uniform `{ error: { code, message, details } }` response
5. **No unused locals/params** — `tsconfig.app.json` has `noUnusedLocals: true, noUnusedParameters: true, noUncheckedIndexedAccess: true`
6. **Socket.IO degrades** — `getSocket()` returns null if unavailable; board data loads via REST
7. **Writes are whitelisted** — `PUT /tasks/:id` and `PUT /boards/:id` validate against zod schemas, so `board`, `createdBy`, and friends cannot be reassigned from the client
8. **Deletes cascade** — removing a board, list, or task also removes its comments, attachments (including the Cloudinary asset), history, and inbound dependency links
9. **Motion is opt-in** — landing reveals only hide content after `.hp-motion` is set at runtime; see `hooks/useScrollReveal.ts`
10. **Landing scroll writes the DOM directly** — the progress rail, condensed nav, and hero parallax are set inside one `requestAnimationFrame` in `HomePage.tsx`, not through React state; routing them through state re-rendered the whole page on every scroll event. `.hp` uses `overflow-x: clip`, not `hidden` — `hidden` forces `overflow-y: auto`, which makes `.hp` the scroll container and stops the sticky nav from sticking

## Tips for AI sessions

- **Reading files**: grep before full reads. `grep -C 2 pattern` for context.
- **API changes**: `routes.ts` has handlers; `index.ts` wires routes + middleware
- **Client changes**: pages in `pages/`, API client in `api.ts`, auth in `auth.tsx`
- **Style changes**: `globals.css` has all design tokens + shared component classes — no separate Tailwind config. Each page also has a sibling CSS file (`HomePage.css`, `DashboardPage.css`, `BoardViewPage.css`, `AuthPage.css`). Bundle order between `globals.css` and page CSS is not guaranteed, so page-level overrides of a shared class need extra specificity (`.input.bv-filter`, not `.bv-filter`)
- **Design system**: "Signal Line" — machine-enamel surfaces, safety-yellow `--color-signal` as the only fill accent (never a text color), signal-lamp semantics (`--color-stop/flow/clear/steel/violet`), Archivo (display, variable width) + IBM Plex Sans (body) + IBM Plex Mono (data). Columns sit as stations on a continuous rail
- **Token scales** — never write a raw value where one of these fits:
  - Radius: `--radius-slip` 2px (inside a plate), `--radius-plate` 3px (a plate), `--radius-well` 4px (a recessed container), `--radius-gauge` 999px (**only** progress bars and meters). Enamel is pressed, not moulded — nothing else is round
  - Space: `--space-1`…`--space-7` on a 4px grid
  - Motion: one curve `--ease-plate`, three durations `--dur-tap` / `--dur-move` / `--dur-enter`. Component transitions live with the component; `globals.css`'s MOTION block is choreography only
  - Chrome: `--bar-h` (app bar), `--tap-min` (44px). `.icon-btn` / `.theme-toggle` gain a 44px pseudo-element hit area under `pointer: coarse`
- **Semantic colours**: `--color-clear` is *done* everywhere (table, checklist, charts); `--color-flow` is *moving / live / today*. Don't mix them
- **Avatars**: `.avatar` plus `.avatar-xs` (20px) or `.avatar-sm` (24px) — never inline `width`/`height`/`fontSize`
- **Shared UI**: `components/Wordmark.tsx` (logo + `RailMark`), `components/ThemeToggle.tsx`, `lib/identity.ts` (avatar colors, initials)
- **Analytics**: `AnalyticsDashboard.tsx` is lazy-loaded on both the board and workspace pages — it carries recharts (~119 kB gzip). Its loading and failure states live in `AnalyticsStates.tsx` so they stay out of that chunk. Every chart renders a visually-hidden data table beside it, so no reading depends on colour
- **Adding a page**: add route in `App.tsx`, create page in `pages/`, add API method in `api.ts`
- **Adding a model**: add schema in `api/models.ts`, add CRUD in `routes.ts`, wire in `api/index.ts`
- **Build check**: `cd client && npx tsc -p tsconfig.app.json --noEmit` (client), `npx tsc -p api/tsconfig.json --noEmit` (api)
- **Tests**: `npm test` runs both suites (`client` vitest + `vitest run --config vitest.config.api.ts`). API tests spin up `mongodb-memory-server`; boards live in a workspace, so use the `workspaceFor()` helper when adding cases

## Remote config

| Env var | Required | Description |
|---------|----------|-------------|
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Access token signing key |
| `JWT_REFRESH_SECRET` | yes | Refresh token signing key (different) |
| `CORS_ORIGIN` | yes | Comma-separated allowed origins |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | no | Attachments; unset ⇒ uploads answer 503 |
| `CLOUDINARY_FOLDER` | no | Upload root, default `gridly` (board id becomes a subfolder) |
| `GEMINI_API_KEY` | no | AI drafting; unset ⇒ AI endpoints answer 503 |
| `GEMINI_MODEL` | no | Model id, default `gemini-3.5-flash`; set when Google retires one |
| `VITE_API_URL` | client | API base URL for Vite dev |
| `VITE_WS_URL` | client | Socket origin; unset in production ⇒ polling only |

See `.env.example` for defaults.

## Vercel notes

- No Socket.IO in production (serverless limitation). Client falls back to REST polling.
- `trust proxy` enabled — Express sees correct client IP
- MongoDB must allowlist Vercel's IPs (or use `0.0.0.0/0`)
- JWT refresh cookies set `secure: true` in production
