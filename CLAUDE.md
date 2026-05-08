# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies
npm run dev        # start Vite dev server (frontend only, no API)
npm run build      # production build to dist/
```

There are no test commands — the project has no test suite.

To run the API locally you need a Vercel environment or to wire up the serverless handlers manually. The `api/` functions are Vercel serverless handlers and do not run with `npm run dev`.

## Environment setup

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` or `SUPABASE_DATABASE_URL` or `POSTGRES_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Long random string used to sign session tokens |
| `RESEND_API_KEY` | Resend API key for sending OTP emails |
| `EMAIL_FROM` | From address for OTP emails (optional, defaults to `bio.sa <onboarding@resend.dev>`) |

The API reads `.env.local` directly via a custom loader in `api/_lib/db.ts` — no separate dotenv setup required.

## Database

Plain PostgreSQL, no ORM. Apply migrations from the `database/` directory in filename order:
1. `phase1-migration.sql` — adds `extracted_colors_json`, `icon_style`, `text_position` columns
2. `phase2-link-files.sql`
3. `phase3-file-category.sql`
4. `phase4-email-otp.sql` — adds `email` to `users`, creates `verification_codes` table

**Schema tables:** `users`, `usernames`, `pages`, `page_links`, `verification_codes`.

The `usernames` table is separate from `users` (one-to-one). Username lookups require joining `usernames` to `pages`/`users` — the `username` field is never stored on the `users` row itself.

## Architecture

This is **bio.sa**, an Arabic-language link-in-bio SaaS (Linktree-style). The app is a Vite + React SPA deployed on Vercel, with the backend as Vercel serverless functions in `api/`.

### Frontend

`src/app/routes.tsx` defines the user journey:
- `/` → Landing page
- `/phone` → Registration/login (email + phone input, OTP verification)
- `/builder` → Page editor (authenticated; redirects to `/phone` if not logged in)
- `/preview` → Live preview of the builder state (renders `PublicPage` with local data)
- `/plan-selection`, `/payment`, `/processing`, `/success` → Upgrade flow
- `/:username` → Public profile page (fetches from API)

**Central state: `PageContext`** (`src/app/context/PageContext.tsx`)

All page-builder state lives here. It:
1. Loads initial state from `localStorage` on mount
2. If a session token exists, hydrates from `/api/page/me` (overwriting localStorage)
3. Auto-saves to the API with a 600 ms debounce on every state change (authenticated only)
4. Persists to `localStorage` on every change (for unauthenticated preview)

The `skipNextRemoteSave` ref prevents an unnecessary round-trip write immediately after a remote fetch.

`updateTheme` has side effects: it resets `wallpaper` to a solid color matching the theme background, and clears `customColors` and `buttonStyle.useCustomColor`/`customColor`.

**`PageData` shape** (defined in `PageContext.tsx`): `username`, `profileImage`, `name`, `bio`, `links[]`, `theme`, `wallpaper`, `buttonStyle`, `profileStyle`, `customColors`, `extractedColors`.

`extractedColors` is populated by `src/app/utils/colorExtractor.ts` (uses `colorthief`) to extract dominant palette colors from the profile image, which the builder surfaces as suggested custom colors.

**`localStorage` keys:**
- `bio_page_data` — serialized `PageData`
- `bio_sa_session_token` — bearer token
- `bio_sa_welcome_seen` — one-time welcome modal flag

### Backend (`api/`)

Vercel serverless handlers. Shared utilities in `api/_lib/`:

- `db.ts` — singleton `pg.Pool`, reads env vars, forces IPv4 for Supabase; uses a `global.__bioSaPool` singleton to survive hot-reload
- `auth.ts` — custom HMAC-SHA256 session tokens (30-day TTL), no JWT library
- `email.ts` — OTP generation (4-digit) and sending via Resend
- `http.ts` — helpers: `allowMethods`, `sendJson`, `readJsonBody`, `handleApiError`
- `page.ts` / `username.ts` — DB queries for page persistence and username validation

**Auth flow (current):** `send-code` → stores OTP in `verification_codes` table → `verify-code` → creates or looks up user, returns a signed session token → client stores token in `localStorage` as `bio_sa_session_token`.

`api/auth/phone-login.ts` is a legacy phone-only endpoint that creates a session without OTP. It is not part of the current UI flow.

**Link save strategy:** `savePageData` in `api/_lib/page.ts` does a full delete-then-reinsert of all `page_links` for the page on every save — it does not diff or patch individual rows.

### Path alias

`@` maps to `./src` (configured in `vite.config.ts`).

### Styling

Tailwind CSS v4 (via `@tailwindcss/vite` plugin). Custom theme tokens in `src/styles/theme.css`. Arabic fonts (Cairo, Tajawal) loaded in `src/styles/fonts.css`. The UI uses Radix UI primitives with shadcn-style components in `src/app/components/ui/`.

### Deployment

Vercel. `vercel.json` rewrites all non-asset paths to `index.html` (SPA routing), and passes `/api/*` to the serverless functions. There is no `next.config.js` — this is plain Vite, not Next.js.
