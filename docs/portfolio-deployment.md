# Gridly hosting and portfolio documentation

Gridly can remain entirely on its existing Vercel project `gridly` (`prj_EYwetDRWTZoht8bbB4m2ERCQlhF5`), connected to `zAyman01/Gridly`, production branch `main`. Its React frontend and Express `api/index.ts` handler already implement this topology. A Railway backend is unnecessary for the present REST/polling deployment.

Use repository root, `npm ci`, `npm run vercel-build`, output `client/dist`, and the existing API-first SPA rewrites in `vercel.json`. Keep `VITE_API_URL` unset or `/api` so refresh cookies and API requests are same-origin. Keep `VITE_WS_URL` unset so production uses the implemented REST polling fallback; Vercel does not host the Socket.IO process. A future requirement for persistent realtime sockets would warrant a backend host, not a duplicate project today.

Production API requires managed MongoDB (`MONGODB_URI`), strong distinct `JWT_SECRET` and `JWT_REFRESH_SECRET`, `NODE_ENV=production`, and an exact `CORS_ORIGIN`. Cloudinary keys enable attachments; `GEMINI_API_KEY` enables AI drafting. Absent optional provider keys cause their endpoints to return 503; they must not be described as working without verification. Set host environment values before building; `VITE_*` values require a new frontend build.

The existing Vercel Git integration creates production deployments on `main` pushes and previews on other branches. Verify the production URL and `/api/health` after renewal; an existing project entry alone does not prove its URL is serving. Check deep links, login/refresh/logout, workspaces, board CRUD and polling after deployment. Preserve the existing database. [Vercel Git integration](https://vercel.com/docs/git/vercel-for-github)

Screenshots use synthetic local fixtures; see [capture instructions](../screenshots/README.md) and [route manifest](../screenshots/manifest.json).
