# Gridly portfolio captures

Run `npm ci`, `npx playwright install chromium`, then `npx playwright test --config screenshots/playwright.config.mjs` from the repository root. The command builds and previews only the real Vite frontend at loopback port 3104. Playwright intercepts all app API calls with realistic workspace, board, task, member, comment and analytics fixtures. No database, backend or paid provider is used, and production auth is unchanged.

Every PNG is a 1920 x 1080 viewport (`fullPage: false`, scale 1). `manifest.json` identifies routes and sections. Captures cover landing sections, auth, workspaces, workspace boards/analytics, board Kanban/table/calendar/timeline/analytics, creation dialogs, task details/discussion, board settings/members/activity and command palette. Original captures are unretouched.
