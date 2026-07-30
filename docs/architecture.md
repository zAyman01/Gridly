# Architecture

## Stack

| Layer | Tech |
|-------|------|
| API | Express 4 + TypeScript |
| Database | MongoDB via Mongoose 8 |
| Auth | JWT (access + refresh token, httpOnly cookie) |
| Client | React 19 + TypeScript + Tailwind v4 |
| Bundler | Vite 6 |
| Real-time | Socket.IO (degraded on Vercel) |
| Hosting | Vercel (serverless API) |
| Image CDN | Cloudinary |
| AI | Google Generative AI (Gemini) |

## Data flow

```
Browser ──► Vite (dev proxy) ──► Express API ──► MongoDB
  │                                    │
  └────── WebSocket ──────────────────┘  (board room updates)
```

### Auth flow

1. `POST /api/auth/login` → returns `{ user, accessToken }` + sets `refreshToken` httpOnly cookie
2. Client stores `accessToken` in `localStorage`, sends as `Authorization: Bearer <token>`
3. `POST /api/auth/refresh` reads `refreshToken` cookie → returns new `accessToken`
4. On logout → clears cookie + removes refreshToken from DB

### Permission model

Board roles are a hierarchy — `owner ⊃ editor ⊃ viewer` — enforced by `requireBoardRole()`, which takes the lowest acceptable role and compares ranks.

- **owner** — full CRUD on board, lists, tasks, members; can moderate any comment
- **editor** — CRUD on lists/tasks/comments/files, can add members
- **viewer** — read-only board access

Workspaces carry their own roles (`admin | member | guest`) for workspace administration. Creating a board requires membership of its workspace.

## Models

```
User ──1:N──> Workspace (owner)
Workspace ──1:N──> Board
Workspace ──N:M──> User (members)
Board ──1:N──> List
List  ──1:N──> Task
Board ──N:M──> User (members, with role)
Task  ──1:N──> ChecklistItem
Task  ──1:N──> TaskDependency
```

## Key decisions

- **Flat API dir** — serverless functions on Vercel need a single entry; flat layout avoids nesting issues
- **Lazy DB connect** — on Vercel, mongoose connects per-request and reuses cached connection
- **Socket.IO graceful degradation** — `getSocket()` returns null when WS unavailable; board data still loads via REST
- **Tailwind v4 @theme** — design tokens defined in CSS, not tailwind.config
