# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product and source of truth

This is **«عنوان» (onwan)** — an Arabic platform where an entity (association, then company) gets one public page on `name.onwan.link` with its identity, links, images and PDF files. The repo folder is still called `bio.sa` (the earlier name).

The requirements live next to the repo, in the parent folder: `../onwan_requirements_reference.docx` (v1.0) and `../onwan_miro_cards.xlsx` (same items as cards, plus later decisions `NEW-01..03`). Code comments cite requirement codes (`ACCT-01`, `PAGE-07`, `SUB-02`, …). Reading rule from the document: **«معتمد»** is binding, **«مقترح/مشروط»** is not, and **«معلّق»** (`P-01..P-16`) must never be given an invented value or behaviour — e.g. prices, storage limits and the payment gateway are still pending.

Built so far: the beneficiary journey and the public page. **Not built yet:** the administration panel, staff roles/audit log, the payment gateway, discount codes, «صمّم لي», the B2B print-partner portal, NFC orders, and multi-language pages.

## Commands

```bash
npm install        # install dependencies
npm run dev        # Vite dev server; also serves api/ in-process (see vite.config.ts)
npm run build      # production build to dist/
```

There is no test suite. `npm run build` does not type-check; check the API with `npx tsc -p api/tsconfig.json --noEmit --ignoreDeprecations 6.0`.

## Environment setup

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` or `SUPABASE_DATABASE_URL` or `POSTGRES_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Long random string used to sign session tokens |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend, for confirmation / password-reset codes |
| `ADMIN_EMAIL` | Mailbox that receives page reports and beneficiary requests (skipped with a warning if unset) |
| `SUPPORT_EMAIL` | Contact shown to a banned account (optional) |
| `ROOT_DOMAIN` / `VITE_ROOT_DOMAIN` | Root of page subdomains, default `onwan.link` |
| `VITE_SUPPORT_WHATSAPP` | Administration WhatsApp number; the button is hidden if unset |

The API reads `.env.local` directly via a custom loader in `api/_lib/db.ts` (it does not override variables already set in the environment).

## Database

Plain PostgreSQL, no ORM. Apply migrations from `database/` in this order: `phase1-migration`, `phase2-link-files`, `phase3-file-category`, `phase4-email-otp`, `allow-single-character-usernames`, `phase5-onwan-requirements`. All are re-runnable.

**Tables:** `users`, `usernames`, `pages`, `page_links`, `verification_codes`, `reserved_usernames`, and from phase 5: `plans`, `subscriptions`, `content_reviews`, `page_reports`, `support_requests`.

- `usernames` is separate from `users` (one-to-one); the name is a DNS label (`[a-z0-9-]`, no underscore).
- `pages.status`: `draft` (not public — the default until payment is confirmed), `published`, `suspended` (visitors see only `suspension_message`). Expiry of a subscription does **not** hide a page; only the administration suspends it (SUB-06/07).
- `users.status = 'banned'` blocks login and live sessions (MOD-06).
- `plans.price_sar` is NULL until the manager sets it.

## Architecture

Vite + React SPA deployed on Vercel, backend as Vercel serverless functions in `api/` (keep the function count ≤ 12 for the Hobby plan; it is 11 now).

### Frontend

`src/app/routes.tsx`:
- `/` → `Landing` on the main domain; on `name.onwan.link` it renders that entity's `PublicPage` (`getSubdomainUsername()` in `src/app/lib/site.ts`)
- `/signup?username=` → phone, email, password (name is chosen on the landing page)
- `/login`, `/reset-password`
- `/builder` → page editor (redirects to `/login` if not authenticated)
- `/preview` → the editor's unsaved draft rendered full-screen
- `/plan-selection` → monthly / annual choice
- `/:username` → public page by path; fallback for local dev and preview deployments

**Central state: `PageContext`** (`src/app/context/PageContext.tsx`) holds `pageData`, `account` (email, verification, page status, subscription) and the editor actions.

- Edits are a **local draft**: they update the live preview and set `isDirty`, and reach the public page only through the explicit `save()` (PAGE-07). There is no auto-save. Every editor mutation goes through the internal `edit()` helper so the dirty flag stays correct.
- On mount with a session token it hydrates from `/api/page/me`, replacing the local draft.
- `updateTheme` resets `wallpaper` to the theme background and clears custom colors.
- `resetDesign` restores the default look only; content is untouched (PAGE-08; exact behaviour is pending P-07).

`src/app/components/PageView.tsx` is the single renderer for both the builder preview (`variant="preview"`) and the real page (`variant="public"`). Change page rendering there, not in `PagePreview`/`PublicPage`.

The public page carries no «عنوان» branding and no QR download (DEF-06, DEF-09); it has share / WhatsApp / copy link, VCF download (`src/app/lib/vcard.ts`) and the report dialog. QR generation is in the builder only.

**`localStorage` keys** (names kept from bio.sa so existing sessions survive): `bio_page_data`, `bio_sa_session_token`, `bio_sa_welcome_seen`.

### Backend (`api/`)

Shared code in `api/_lib/`:

- `db.ts` — lazy singleton `pg.Pool`
- `auth.ts` — HMAC-SHA256 session tokens (30-day TTL); `session.ts` — `requireUser()` loads the user on every request and rejects banned accounts
- `password.ts` — scrypt hashing; `otp.ts` — 6-digit one-time codes with cooldown and attempt limit
- `http.ts` — `HttpError` (message is shown to the client) and `handleApiError` (anything else becomes a generic 500; details stay in the log)
- `page.ts` — page persistence and validation: max 20 buttons, files limited to images and PDF, link URLs limited to http(s)/mailto/tel. Every save inserts a `content_reviews` row (status `pending`) for the administration.
- `account.ts` — account summary, plans, `requestSubscription()` and `activateSubscription()`

**Publishing rule:** only `activateSubscription()` may publish a page. It must be called from the payment gateway's confirmed-payment webhook (gateway not chosen yet, P-08) or from an administration action — never from a browser request. `POST /api/subscription` only records the chosen plan as `pending_payment`.

Endpoints: `auth/signup`, `auth/login`, `auth/reset-password` (`action: request | confirm`), `auth/send-code` + `auth/verify-code` (email confirmation for the signed-in user), `page/me`, `public-page`, `username/check`, `subscription`, `report`, `requests`.

**Files** (logo, wallpaper, images, PDFs) are still stored inline as data URLs in the database, capped at 2–3 MB client-side. Real storage, quotas and file-replace-with-same-URL (FILE-02) wait on P-02.

**Link save strategy:** `savePageData` deletes and re-inserts all `page_links` on every save, so link ids change on each save.

### Path alias

`@` maps to `./src` (configured in `vite.config.ts`).

### Styling

Tailwind CSS v4 (via `@tailwindcss/vite` plugin). Custom theme tokens in `src/styles/theme.css`. Arabic fonts loaded in `src/styles/fonts.css`; the fonts a beneficiary can pick are `FONT_OPTIONS` in `PageContext.tsx` — add a font in both places. The UI uses Radix UI primitives with shadcn-style components in `src/app/components/ui/`.

### Deployment

Vercel. `vercel.json` rewrites all non-asset paths to `index.html` (SPA routing), and passes `/api/*` to the serverless functions. Pages on `name.onwan.link` need the wildcard domain `*.onwan.link` added to the Vercel project. The public page sets its title/description client-side; real SEO and share previews (SEO-01/02) need server-rendered meta tags, which this SPA does not have yet.
