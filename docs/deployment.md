# Deployment

## Vercel

The project deploys as a single Vercel project with:
- **Client** — Vite static build served from `client/dist`
- **API** — Express app wrapped as a serverless function (`api/index.ts` → `handler`)

### Configuration

`vercel.json`:
```json
{
  "buildCommand": "cd client && npx vite build",
  "outputDirectory": "client/dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Env vars (required)

| Var | Example |
|-----|---------|
| `MONGODB_URI` | `mongodb+srv://...` |
| `JWT_SECRET` | 64-char random |
| `JWT_REFRESH_SECRET` | 64-char random (different) |
| `CORS_ORIGIN` | `https://your-app.vercel.app` (comma-sep for multiple) |
| `NODE_ENV` | `production` |

### Env vars (optional)

| Var | Effect when unset |
|-----|-------------------|
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Attachment uploads answer `503 UPLOADS_DISABLED` |
| `CLOUDINARY_FOLDER` | Defaults to `gridly` — the top-level folder uploads land in |
| `MAX_FILE_SIZE_MB` | Defaults to 10 |
| `GEMINI_API_KEY` | AI endpoints answer `503 AI_DISABLED` |
| `GEMINI_MODEL` | Defaults to `gemini-3.5-flash`; set it if Google retires that id (calls start 404ing) |
| `VITE_WS_URL` | The client makes no socket attempt in production and polls instead |

### Important notes

- **No Socket.IO on Vercel** — WS connections aren't supported in serverless functions. Client degrades gracefully (REST-only).
- **`trust proxy` enabled** — Express reads correct IP behind Vercel's reverse proxy.
- **Lazy MongoDB** — `mongoose.connect()` happens on first request and reuses the cached connection via `global.mongooseCache`.
- **MongoDB Atlas** — ensure IP whitelist includes `0.0.0.0/0` (or Vercel's NAT IPs) and use SRV connection string.

### Deploy

1. Push to GitHub
2. Import in Vercel → framework preset: **Other**
3. Add env vars in Vercel dashboard
4. Deploy

## Local dev

```bash
# Install
npm install

# Start both
npm run dev

# Or separately
npm run dev:api   # Express on :4000
npm run dev:client # Vite on :5173 (proxied to :4000)
```

### Prerequisites

- Node 20+
- MongoDB running locally (or an Atlas URI in `.env`)

### Configuration

One file, at the repo root: copy `.env.example` to `.env` and fill it in. `api/config.ts` loads it by absolute path, so it applies whichever directory you start from, and Vite reads the `VITE_*` keys from the same file. Real environment variables take precedence, which is how production works — set them in the Vercel dashboard and ship no `.env` at all.
