# Frontend

## Stack

- React 19 + TypeScript 5
- Vite 6 (dev proxy → `localhost:4000`)
- Tailwind CSS v4 — no config file, tokens live in `globals.css` under `@theme`
- React Router v8 — imports come from `react-router`; the `react-router-dom` shim no longer exists
- Recharts (analytics), `@hello-pangea/dnd` (drag and drop), `@tanstack/react-virtual` (table view)
- Socket.IO client, with REST polling as the fallback

## Design system — "Signal Line"

The vocabulary is a dispatch floor: a rail, stations along it, work-order slips, signal lamps, machine-enamel surfaces.

| Token | Role |
|-------|------|
| `--paper` / `--panel` / `--sunk` | surfaces, light and dark |
| `--ink` / `--muted` / `--rule` | text and hairlines |
| `--color-signal` | safety yellow — the only fill accent, never a text colour |
| `--color-stop` / `--color-flow` / `--color-clear` / `--color-steel` / `--color-violet` | lamp semantics |
| `--ease-plate` | the one easing curve, used by every transition |

Type: **Archivo** (display, variable width), **IBM Plex Sans** (body), **IBM Plex Mono** (data and labels).

Themes swap by putting `.dark` on `<html>` (see `theme.tsx`); every token is redefined there.

### Shared classes

- `.btn` + `.btn-primary|secondary|danger` + `.btn-xs|sm|md|lg`
- `.input`, `.textarea`, `.select-input`, `.field-label`, `.error-banner`
- `.modal-overlay`, `.modal-panel`, `.modal-head`, `.modal-section`, `.modal-foot`, `.modal-tabs`
- `.board-layout`, `.column`, `.column-plate`, `.column-body`, `.task-card`, `.task-card-cover`
- `.label-chip`, `.lamp`, `.avatar`, `.avatar-stack`, `.skeleton`
- `.custom-fields`, `.dep-list`, `.field-schema-list` — card detail and board settings

Page-level CSS sits next to the page (`HomePage.css`, `DashboardPage.css`, `BoardViewPage.css`, `AuthPage.css`). Bundle order between `globals.css` and page CSS is not guaranteed, so page overrides of a shared class need extra specificity (`.input.bv-filter`, not `.bv-filter`).

## Motion

- One curve (`--ease-plate`) and short durations; hovers lift by 1–2px, modals enter with a small rise.
- The landing page reveals sections on scroll through `hooks/useScrollReveal.ts`: an IntersectionObserver adds `.is-in`, and a timer sweep catches anything the observer misses, so content is never stranded behind an animation that did not run.
- Hidden states only apply once the page adds `.hp-motion`, which it does after mount and only when `prefers-reduced-motion` is not set.
- `globals.css` ends with a `prefers-reduced-motion` block that flattens every animation and transition.

## Routes

| Route | Page | Auth |
|-------|------|------|
| `/` | HomePage | public |
| `/login` | LoginPage | public |
| `/signup` | SignupPage | public |
| `/workspaces` | DashboardPage | protected |
| `/w/:slug` | WorkspacePage | protected |
| `/boards/:boardId` | BoardViewPage | protected |

The three protected pages are `React.lazy`, so the landing page never downloads charts, drag-and-drop, or sockets.

## Board views

`BoardViewPage` owns the data and hands it to one of five views via `ViewSwitcher`:

| View | File | Notes |
|------|------|-------|
| Board | `pages/views/KanbanView.tsx` | Drag cards and columns; positions save on drop |
| Table | `pages/views/TableView.tsx` | Virtualised rows |
| Calendar | `pages/views/CalendarView.tsx` | Month grid keyed on due date |
| Timeline | `pages/views/TimelineView.tsx` | Gantt-style bars, flags blocked cards |
| Analytics | `components/AnalyticsDashboard.tsx` | Recharts, loaded with the page chunk |

## Auth flow

- `AuthProvider` wraps the app; on mount it checks `localStorage` for `gridly_accessToken` and calls `/api/auth/me`
- `login()` / `signup()` store the token, `logout()` clears it
- `ProtectedRoute` redirects to `/login`, `PublicRoute` redirects signed-in users to `/workspaces`

## API client

`api.ts` exposes one `request<T>()` that attaches the bearer token, sends `credentials: "include"` for the refresh cookie, retries once through `/auth/refresh` on a 401, and throws the server's message on failure. Upload calls go through `uploadRequest()` so the browser can set the multipart boundary.

## WebSocket

`socket.ts` is a lazy singleton:
- Connects with the access token; joins and leaves a room per board
- `onBoardChange(cb)` subscribes to board updates
- Returns `null` when no socket URL is configured in production, and `usePollingFallback` then refetches every 30s — skipping the fetch while a socket is live or the tab is hidden

## Build

```bash
cd client
npm run dev    # dev server :5173
npm run build  # production → dist/
npm test       # vitest
```
