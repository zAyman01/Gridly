# API Reference

Base URL: `/api` (dev: `http://localhost:4000/api`)

Every response is wrapped: success is `{ "data": … }`, failure is `{ "error": { "code", "message", "details" } }`.

## Auth

### `POST /api/auth/signup`
```json
{ "email": "a@b.com", "password": "min8chars", "name": "Alice" }
→ 201 { "data": { "user": {...}, "accessToken": "..." } }
```

### `POST /api/auth/login`
```json
{ "email": "a@b.com", "password": "..." }
→ 200 { "data": { "user": {...}, "accessToken": "..." } }
```

Sets a `refreshToken` httpOnly cookie on both (path `/api/auth`).

### `POST /api/auth/refresh`
Reads the `refreshToken` cookie → `{ "data": { "accessToken": "..." } }`. The refresh token rotates on every call.

### `POST /api/auth/logout`
Requires auth. Clears the stored refresh token.

### `GET /api/auth/me`
Requires auth. Returns the current user.

---

## Roles

Board membership carries one of three roles, and they are a **hierarchy**:

```
owner ⊃ editor ⊃ viewer
```

A route marked `editor` accepts editors and owners; a route marked `viewer` accepts everyone on the board. The board's `owner` field always resolves to `owner`, whatever the members array says.

Workspaces have their own roles — `admin | member | guest` — used for workspace administration only.

---

## Workspaces

All workspace endpoints require `Authorization: Bearer <token>`.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/api/workspaces` | auth | Workspaces the caller belongs to |
| `POST` | `/api/workspaces` | auth | Create `{ name, slug }` — slug is `[a-z0-9-]`, unique |
| `GET` | `/api/workspaces/:slug` | member | `{ workspace, boards, role }` |
| `PUT` | `/api/workspaces/:slug` | admin | Update `{ name }` |
| `DELETE` | `/api/workspaces/:slug` | owner | Delete the workspace and every board under it |
| `POST` | `/api/workspaces/:slug/members` | admin | Add `{ userId, role? }` |
| `DELETE` | `/api/workspaces/:slug/members/:userId` | admin | Remove a member |

## Boards

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/api/boards` | auth | Caller's boards (`?workspace=<id>` to filter) |
| `POST` | `/api/boards` | auth | Create `{ title, description?, workspace }` — caller must belong to the workspace |
| `GET` | `/api/boards/:boardId` | viewer | Board detail + lists + `tasksByList` |
| `PUT` | `/api/boards/:boardId` | editor | Update `{ title?, description?, visibility?, customFields? }` |
| `DELETE` | `/api/boards/:boardId` | owner | Delete the board and its lists, tasks, comments, files, and history |
| `POST` | `/api/boards/:boardId/members` | editor | Add member `{ userId, role? }` |
| `PUT` | `/api/boards/:boardId/members/:userId/role` | owner | Set `{ role: "editor" \| "viewer" }` |
| `DELETE` | `/api/boards/:boardId/members/:userId` | owner | Remove member (also unassigns their cards) |

### Custom field schema

```json
{ "name": "Impact", "type": "text|number|date|select|multiselect|checkbox", "options": ["A"], "required": false }
```

Values live on the task as `customFieldValues` — a map keyed by field name.

## Lists

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/api/boards/:boardId/lists` | viewer | Lists, sorted by position |
| `POST` | `/api/boards/:boardId/lists` | editor | Create `{ title, position? }` |
| `POST` | `/api/boards/:boardId/lists/reorder` | editor | `{ orders: [{ listId, position }] }` |
| `PUT` | `/api/boards/:boardId/lists/:listId` | editor | Update `{ title?, position? }` |
| `DELETE` | `/api/boards/:boardId/lists/:listId` | editor | Delete the list, its tasks, and their comments and files |

## Tasks

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/api/boards/:boardId/tasks` | viewer | All tasks on the board |
| `POST` | `/api/boards/:boardId/tasks` | editor | Create a task |
| `PUT` | `/api/boards/:boardId/tasks/:taskId` | editor | Update the fields below |
| `DELETE` | `/api/boards/:boardId/tasks/:taskId` | editor | Delete the task, its comments, files, and inbound dependencies |
| `PUT` | `/api/boards/:boardId/tasks/:taskId/move` | editor | Move `{ targetListId, position }` — positions in the destination list are re-packed |

### Task schema (create)
```json
{
  "listId": "...",
  "title": "...",
  "description": "",
  "priority": "low|medium|high|urgent",
  "status": "todo|in_progress|done",
  "assignees": ["userId"],
  "dueDate": "2026-01-01T00:00:00Z",
  "tags": ["tag1"],
  "position": 0
}
```

### Task schema (update)

Only these keys are accepted; anything else is rejected with `BAD_REQUEST`:

`title`, `description`, `listId`, `position`, `priority`, `status`, `assignees`, `dueDate` (nullable), `tags`, `coverImage` (URL, nullable), `customFieldValues`, `dependencies`.

Setting `status: "done"` stamps `completedAt`; any other status clears it. That timestamp is what the velocity chart reads.

```json
"dependencies": [{ "task": "<taskId>", "type": "blocks" | "blocked_by" }]
```

## Comments

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/api/boards/:boardId/tasks/:taskId/comments` | viewer | Thread, oldest first |
| `POST` | `/api/boards/:boardId/tasks/:taskId/comments` | editor | Create `{ body, mentions? }` |
| `PUT` | `…/comments/:commentId` | editor | Edit — author only |
| `DELETE` | `…/comments/:commentId` | editor | Delete — author, or the board owner |

## Checklist

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `POST` | `…/tasks/:taskId/checklist` | editor | Add `{ text }` |
| `POST` | `…/tasks/:taskId/checklist/reorder` | editor | `{ orders: [{ itemId, position }] }` |
| `PUT` | `…/checklist/:itemId` | editor | Toggle `{ done }` |
| `DELETE` | `…/checklist/:itemId` | editor | Remove an item |

All four return the whole checklist.

## Attachments

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `…/tasks/:taskId/attachments` | viewer | Files on the task |
| `POST` | `…/tasks/:taskId/attachments` | editor | `multipart/form-data`, field `file` |
| `DELETE` | `…/attachments/:attachmentId` | editor | Remove from Cloudinary and the database |

Uploads answer `503 UPLOADS_DISABLED` unless all three Cloudinary credentials are set. Files land in `CLOUDINARY_FOLDER/<boardId>/`. Max size is `MAX_FILE_SIZE_MB` (default 10).

## Analytics

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/api/analytics/board/:boardId` | viewer | Totals for one board |
| `GET` | `/api/analytics/workspace/:slug` | member | Totals across the caller's boards in that workspace |

```json
{ "totalTasks": 42, "completionRate": 0.35,
  "tasksByStatus": { "todo": 10, "in_progress": 5, "done": 27 },
  "tasksByPriority": { "low": 4, "medium": 20, "high": 12, "urgent": 6 },
  "tasksByAssignee": [{ "userId": "...", "name": "Alice", "count": 9 }],
  "velocity": [{ "date": "2026-07-01", "count": 3 }] }
```

## AI (Gemini)

Both endpoints require the `editor` role on the board and write their result to the task.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ai/boards/:boardId/tasks/:taskId/draft-description` | Writes a markdown description from the title; returns the text |
| `POST` | `/api/ai/boards/:boardId/tasks/:taskId/breakdown` | Appends 3–5 checklist items; returns the checklist |

Answers `503 AI_DISABLED` when `GEMINI_API_KEY` is unset, and `502 AI_BAD_FORMAT` when the model returns something unusable. The key never reaches the browser.

## Activity & users

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/api/boards/:boardId/activity` | viewer | Last 50 entries, newest first |
| `GET` | `/api/users/search?q=` | auth | Match up to 10 users by name or email |

## Health

### `GET /api/health`
`{ "status": "ok", "timestamp": "..." }`

## Error codes

| Code | Status |
|------|--------|
| `BAD_REQUEST` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `RATE_LIMITED` | 429 |
| `INTERNAL_ERROR` | 500 |
| `AI_BAD_FORMAT` / `AI_EMPTY` | 502 |
| `AI_DISABLED` / `UPLOADS_DISABLED` | 503 |

## Rate limits

- Global: 600 requests / 15 min
- Auth: 20 requests / 15 min
- AI: 30 requests / 15 min
