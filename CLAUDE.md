# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Cloudflare runtime (19 Oct 2026)

The primary deployment is now Cloudflare Workers + Static Assets (`wrangler.jsonc`, `worker/index.ts`), with the original API business handlers reused through a Fetch adapter. See `CLOUDFLARE_DEPLOY.md` for deployment, variables, DNS, and verification. Supabase/schema are unchanged. `api/_lib/runtime.ts` provides request-scoped env; do not read secrets from process.env in business code or mutate process.env in Workers. `db.ts` owns a lazy per-request Pool, closed by the Worker entrypoint. Vite loads .env.local for local Node development only. Legacy Vercel deployment config remains available. Custom customer domains use the existing manual hosting-confirmation path on Workers, never Vercel API automation. The old deployment section below describes legacy Vercel behavior.

Validation: `npm run check:worker`, `npm run build:worker`, `npm run test:content`, `npm run test:worker` (build dist first). Tests mock database writes and external mail; runtime tests run the bundle/crypto/static assets in workerd. Never run schema migrations or production signup in tests. Password hashing remains scrypt; provision sufficient Worker CPU (Paid) rather than weakening existing hashes.

## Product and source of truth

This is **«عنوان» (onwan)** — an Arabic platform where an entity (association, then company) gets one public page on `name.onwan.link` with its identity, links, images and PDF files. The repo folder is still called `bio.sa` (the earlier name).

The requirements live next to the repo, in the parent folder: `../onwan_requirements_reference.docx` (v1.0) and `../onwan_miro_cards.xlsx` (same items as cards, plus later decisions `NEW-01..03`). Code comments cite requirement codes (`ACCT-01`, `PAGE-07`, `SUB-02`, …). Reading rule from the document: **«معتمد»** is binding, **«مقترح/مشروط»** is not, and **«معلّق»** (`P-01..P-16`) must never be given an invented value or behaviour — e.g. prices, storage limits and the payment gateway are still pending.

**Decisions newer than the documents (given by the owner on 13 Oct 2026; they override the docx/xlsx until those are updated):**

- NEW-01 / ACCT-03 / AC-01.02 (amended): the chosen name is only *held* at signup and is fixed in `usernames` when the payment is confirmed. The beneficiary may change it before paying, which releases the previous hold; nobody else can take a held name during the hold.
- NEW-06 (replaces DES-03..08, COR-06, P-01, AC-10.03/04): «صمّم لي» is a one-time service that ends when the design is approved — no edit balance, no validity period. DES-01/02 stand.
- NEW-04 / NEW-05: one registration cart (plan + «صمّم لي» + NFC pieces) paid together, with a summary before payment showing the link, its QR code, the Apple Wallet card and the total including shipping.
- NFC-02 (amended): NFC pieces can be ordered in the registration cart or later from the dashboard. NEW-07 / NFC-03: the customer is contacted before shipping.
- NFC-05 / P-06: the Apple Wallet card is approved (P-06 closed); only its technical design remains. Google Wallet is undecided.
- SHARE-02 (15 Oct 2026): the contact card (VCF) uses the phone and email the account signed up with. `page.ts` reads them from `users` (`owner.phone` / `owner.email` as `contact_phone` / `contact_email`); the editor no longer has these fields and saves no longer write `pages.contact_*`.
- **Subscription prices (owner decision, 25 Oct 2026 — everyone must know): monthly 19.28 SAR, annual 192.24 SAR; the annual plan carries «الأفضل للعميل».** Stored in `plans` (`database/phase23-plan-prices.sql`, already applied to the database in `.env.local`); the manager can still change them from the admin panel.
- Still open: how long a name hold lasts, and whether discount codes (PAY-03) cover NFC pieces.

Built so far: the beneficiary journey, the public page, the administration panel (`/admin`: staff, permissions matrix, audit log) and the print-partner portal (`/partner`, B2B-01..16). Also built: «صمّم لي», NFC orders, account changes (ACCT-05), restorable deletions, visit counts, an English version of the page, image cropping, staff editing of customer pages, and manager reports. The registration cart, temporary name holds and the one-time «صمّم لي» follow the 13 Oct decisions above. **Not built yet:** issuing real Apple Wallet passes (the cart shows a preview of the card only — signing a pass needs an Apple Developer certificate), the payment gateway and real payment links (every payment is confirmed by hand in `/admin`), SMS (so no phone OTP, B2B-04), real file storage (P-02), button-click statistics, and wallet passes.

## Commands

```bash
npm install        # install dependencies
npm run dev        # Vite dev server; also serves api/ in-process (see vite.config.ts)
npm run build      # production build to dist/
```

`npm run build` does not type-check; run `npm run check:worker`. Content and Worker suites are listed above.

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
| `ADMIN_SETUP_TOKEN` | One-time secret (16+ chars) that lets the «إعداد أول مرة» form at `/admin` create the first manager while the `staff` table is empty |

Vite loads `.env.local` for local development. Workers use request env bindings; see the Cloudflare deployment guide.

## Database

Plain PostgreSQL, no ORM. Apply migrations from `database/` in this order: `phase1-migration`, `phase2-link-files`, `phase3-file-category`, `phase4-email-otp`, `allow-single-character-usernames`, `phase5-onwan-requirements`, `phase6-admin`, `phase7-partners`, `phase8-services`, `phase9-cart-and-name-hold`, `phase10-discounts`, `phase11-custom-domains`, `phase12-renewals`, `phase13-link-icons`, `phase14-link-display`. All are re-runnable. Phase 9 drops the edit-balance structures phase 8 created (`design_edits`, `design_packages.edits_*` / `expires_at`). `database/onwan-schema.sql` is the owner's own dump of the live schema — do not edit it.

**Tables:** `users`, `usernames`, `pages`, `page_links`, `verification_codes`, `reserved_usernames`, and from phase 5: `plans`, `subscriptions`, `content_reviews`, `page_reports`, `support_requests`, from phase 6: `staff`, `audit_log`, `username_redirects`, and from phase 7: `partners`, `partner_orders`, `partner_commissions`, `partner_payouts`, `account_setup_tokens`, and from phase 8: `settings`, `design_packages`, `nfc_orders`, `deleted_links`, `page_visits_daily`, `payments`, and from phase 9: `username_reservations`, `registration_carts` and the view `customer_names`.

- `usernames` is separate from `users` (one-to-one); the name is a DNS label (`[a-z0-9-]`, no underscore). It holds **fixed** names only. An unpaid beneficiary's name is a row in `username_reservations` (`expires_at` NULL = held until payment or change, because the hold duration is undecided; the manager can set `name_hold_days`). Read a customer's name through the view `customer_names` (`username`, `is_fixed`, `hold_expires_at`), not by joining `usernames`, or unpaid customers show up nameless. `reserveUsername()` in `username.ts` is the only writer of holds; `activateSubscription()` is what fixes a name.
- Discounts (PAY-02..04) exist only in the registration cart and only on the plan price: `plans.discount_percent` is the manager's general discount, `discount_codes` are the codes. `pricePlan()` in `account.ts` is the single pricing rule (general discount, then the code on the remainder, never below zero; one code per customer); a code's use is counted when the cart is paid. «صمّم لي» is never discounted (PAY-03), and NFC is not either until the owner decides.
- `custom_domains` (DOMAIN-03): `pending_payment → awaiting_dns → dns_verified → active` (or `removed`). The fee is the setting `custom_domain_price`. The DNS record pointing at the hosting target is the proof of control (`domains.ts`: `checkDns`, targets overridable with `CUSTOM_DOMAIN_CNAME_TARGET` / `CUSTOM_DOMAIN_APEX_IP`). Activation attaches the domain to the Vercel project through its API when `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` are set — that call has never been run against a real project — otherwise staff add it in the dashboard and confirm. On such a host the SPA finds the page with `public-page?host=` (`getCustomHost()` in `site.ts`); the server-rendered SEO rewrite does not cover custom domains. `name.onwan.link` keeps working alongside.
- `registration_carts`: at most one `pending_payment` cart per customer, with prices frozen at submission. `carts.confirmPayment` is all-or-nothing: subscription + name fix + publish, «صمّم لي» opened as paid, NFC order inserted as paid.
- `pages.status`: `draft` (not public — the default until payment is confirmed), `published`, `suspended` (visitors see only `suspension_message`). Expiry of a subscription does **not** hide a page; only the administration suspends it (SUB-06/07).
- `users.status = 'banned'` blocks login and live sessions (MOD-06).
- `plans.price_sar` is NULL until the manager sets it. **Test prices (21 Oct 2026, owner request):** with `DEMO_PRICES=true` (`api/_lib/demoPrices.ts`) unset plan / NFC / domain prices fall back to labelled test values so the cart can be walked through; real values always win; set only in `.env.local`, never in production. «صمّم لي» is 43 SAR by owner decision (note 45), overridable by `DESIGN_SERVICE_PRICE_SAR`.
- `username_redirects`: after a paid link change the old name forwards to the new one for 30 days and counts as taken until it expires (DOMAIN-02).
- `settings` holds the numbers the manager enters (`nfc_unit_price`, `nfc_shipping_price`, `name_hold_days`); they have no defaults because they are pending decisions, and the dependent feature stays closed until they are set. The «صمّم لي» price is the env var `DESIGN_SERVICE_PRICE_SAR` on purpose (DES-01: not editable from the panel).
- `payments` gets a row for every payment an employee confirms (subscription, partner sale, design, NFC); it is the only revenue source for `reports.summary`.
- `deleted_links` archives every button removed by a save or by staff, so the manager can restore it (PERM-19); nothing purges it (retention is pending, P-09).
- `page_links.custom_icon` (phase 13): a button's own icon — `icon:<id>` from `src/app/lib/linkIcons.tsx` or a small uploaded image (data URL, ≤200 KB, cropped to 128 px). Only website / custom / file buttons offer it; brand platforms keep their logo. Never rename a library id.
- `page_links.display_json` (phase 14): optional card layout/image/fit/position, or `{kind: 'heading'}` for a standalone section title. Sections use a stable `sectionId` in both the heading and its member links, independent of row ids. Hiding a section also excludes its members from the public API; deleting it ungroups its links. Heading rows have an empty URL and remain sortable/hideable. Empty metadata preserves the existing button layout.
- Videos: `display.kind = 'video'` embeds supported YouTube/Vimeo/HTTPS MP4/WebM URLs in a content player. `wallpaper.type = 'video'` uses a direct HTTPS MP4/WebM URL with optional poster, position and dim; muted loop, pause control and reduced-motion support. The editor uploads a picked file at once, applies poster/position/dim straight to the draft, and takes the video's first frame as the poster when none is set; a video that cannot play leaves the poster in place.
- Background photo (note 27): `wallpaper.positionX` / `positionY` (0–100) and `zoom` (1–3), set in «تنسيق»; rendered by `WallpaperImage.tsx`. Older pages with only `position` (top/center/bottom) map onto the vertical focus.
- Profile shapes (note 29): the editor offers five; `hero_safe` («مشهد متوازن») is no longer offered but still renders, and counts as «صورة عريضة» (`hero`) in the picker.
- `subscriptions.status` is not flipped when the period ends; expiry is derived from `expires_at`.

## Architecture

Vite + React SPA deployed on Vercel, backend as Vercel serverless functions in `api/` (keep the function count ≤ 12 for the Hobby plan; it is 11 now — add features as actions inside `api/account.ts` / `api/admin.ts` / `api/partner.ts`, not as new files).

### Frontend

`src/app/routes.tsx`:
- `/` → `Landing` on the main domain; on `name.onwan.link` it renders that entity's `PublicPage` (`getSubdomainUsername()` in `src/app/lib/site.ts`)
- `/signup?username=` → phone, email, password (name is chosen on the landing page)
- `/login`, `/reset-password`
- `/builder` → page editor (redirects to `/login` if not authenticated)
- `/preview` → the editor's unsaved draft rendered full-screen
- `/plan-selection` → the registration cart and its pre-payment summary (NEW-04/05)
- `/partners` → partnership application; `/partner` → partner portal (`src/app/partner/`, token `onwan_partner_token`); `/pay/:token` → the customer's view of a partner order; `/welcome/:token` → the customer creates their password (B2B-05)
- `/admin/edit/:userId` → the same `Builder` editing a customer's page (PERM-01): `StaffPageEditor` mounts a nested `PageProvider` with a `source` that loads/saves through the admin API, and passes `staffEdit` to hide the owner-only parts
- `/admin` → administration panel (`src/app/admin/`), with its own staff login and token (`onwan_staff_token`), independent of `PageContext`
- `/:username` → public page by path; fallback for local dev and preview deployments

**Central state: `PageContext`** (`src/app/context/PageContext.tsx`) holds `pageData`, `account` (email, verification, page status, subscription) and the editor actions.

- Edits are a **draft**: they update the live preview and set `isDirty`, and reach the public page only through the explicit `save()` (PAGE-07). REQ-015 (25 Oct 2026): the draft is also kept on the server by itself (`PATCH /api/page/me` with `draft: true`, stored in `pages.draft_json`), merged into one save 2.5 s after editing pauses, restored on load from any device, dropped on publish or when the edits are undone back to the published version. Drafts and publishing share a limit of 200 saves a day per account (`page_save_counts`, one atomic upsert; 429 `save_limit`). Needs `database/phase20-drafts-and-save-limit.sql`. Every editor mutation goes through the internal `edit()` helper so the dirty flag stays correct.
- On mount with a session token it hydrates from `/api/page/me`, replacing the local draft.
- Undo / redo (`undo`, `redo`, `canUndo`, `canRedo`) keep snapshots of `pageData` taken in `edit()`; typing within 0.7 s is one step, a save does not clear them, `replacePageData` (login / hydrate) does. `isDirty` after an undo is `data !== savedPageData` (the saved copy is the same object as the draft right after a save or load). `restoreDraft` puts a whole earlier state back as one step.
- `updateTheme` resets `wallpaper` to the theme background and clears custom colors.
- PAGE-16: the English version is `translations.en` (name, description) plus `titleEn` on each link (kept on the link itself). Arabic and English are the only languages.
- `resetDesign` restores the default look only; content is untouched (PAGE-08; exact behaviour is pending P-07).

The builder renders its editor panels twice (mobile and desktop layouts, one hidden by CSS). Keep editor-local state reachable from the visible instance: wrap file inputs in their label or use `useId()` — never a fixed `id`.

`src/app/components/PageView.tsx` is the single renderer for both the builder preview (`variant="preview"`) and the real page (`variant="public"`). Change page rendering there, not in `PagePreview`/`PublicPage`.

The public page carries no «عنوان» branding and no QR download (DEF-06, DEF-09); it has share / WhatsApp / copy link, VCF download (`src/app/lib/vcard.ts`) and the report dialog. QR generation is in the builder only.

**`localStorage` keys** (names kept from bio.sa so existing sessions survive): `bio_page_data`, `bio_sa_session_token`, `bio_sa_welcome_seen`.

**Session isolation (note 42, 21 Oct 2026):** `bio_page_data` holds `{ owner, data }`, where owner is `user:<id>` from the browser's token or `guest`; a draft is loaded only for the same owner (ownerless drafts are dropped) and never written under a different session. `clearSessionToken()` fires `onwan:session-cleared`, and `PageContext` then drops the account from memory (also on a token change in another tab). Logout also removes the draft and all `onwan_design_history_*` versions. Only a guest's new signup keeps the guest design; logging in never does. The server scopes every customer endpoint to the session user (test in `tests/worker.test.cjs`). `database/phase15-rls-lockdown.sql` enables RLS on all public tables and revokes the Supabase `anon` / `authenticated` roles — not applied yet; run it as the app's own role.

**Buttons and colours (notes 31–34):** `buttonStyle` may hold exact `heightPx` / `fontPx` / `iconPx`, `fontWeight`, `textColor`, and `iconColor: 'custom'` with `iconCustomColor`; `customColors` may hold `headingColor` and `paragraphColor`. `buttonMetrics()` in `src/app/lib/buttonSizes.ts` gives the effective sizes and keeps text and logo inside the button. A preset size clears the exact ones; a theme change clears `textColor`. Brand logos are official Simple Icons paths in `src/app/lib/brandIcons.ts`.

**Verification codes (note 38):** `issueCode()` answers a resend within the cooldown with 429 and code `resend_wait:<seconds>`; `email-code` `send` returns `{ sent, retryAfter }` and treats a code sent moments ago (e.g. at signup) as sent. The client's `ApiError` keeps status and code (`resendWait()`), so waiting is shown calmly, never in red.

### Backend (`api/`)

Shared code in `api/_lib/`:

- `db.ts` — lazy singleton `pg.Pool`
- `auth.ts` — HMAC-SHA256 session tokens (30-day TTL); `session.ts` — `requireUser()` loads the user on every request and rejects banned accounts
- `password.ts` — scrypt hashing; `otp.ts` — 4-digit one-time codes with cooldown and attempt limit
- `http.ts` — `HttpError` (message is shown to the client) and `handleApiError` (anything else becomes a generic 500; details stay in the log)
- `page.ts` — page persistence and validation: max 20 buttons, files limited to images and PDF, link URLs limited to http(s)/mailto/tel. Every save inserts a `content_reviews` row (status `pending`) for the administration.
- `accountActions.ts` — the signed-in beneficiary's actions behind `api/account.ts`: requests to the administration, «صمّم لي» request, NFC order, ACCT-05 changes (a code to the registered email; a new email needs a second code sent to it), and the overview shown in the «الحساب» tab
- `services.ts` / `adminServices.ts` — settings, «صمّم لي» (request → paid → done at `design.approve`; a new request only when none is open), NFC orders (`pending_payment → paid → contacted → shipped`; shipping requires the contact step), the registration cart, restore of deleted content, staff page save, manager reports
- `account.ts` — account summary (including `nameFixed`), plans, `requestSubscription()` and `activateSubscription()`
- `admin.ts` — every administration action as an entry in one `handlers` map, each declaring its access: `staff` (any active employee), `manager`, or `staff` + a `permission` the manager grants per employee (`GRANTABLE_PERMISSIONS`, currently only `change_subdomain`). `runAdminAction()` is the single place the permissions matrix (requirements section 8) is enforced, and every mutating handler writes an `audit_log` row. Session tokens carry `kind: 'staff'` / `'partner'`; each API accepts only its own kind (`requireUser()` rejects any token with a kind).

**Print partners** (`partner.ts`, `adminPartners.ts`): a partner applies and is inactive until an employee approves. The manager sets each partner's price per plan (`price_monthly` / `price_annual`), which is both the partner's sale floor and the base of the first-sale profit (`sale_price − partner_price`); until it is set the partner cannot sell that plan. An order holds its name and the customer's email/phone for `PARTNER_ORDER_WINDOW_DAYS` (3), after which it leaves the partner's list but stays with the administration. No user account exists until the admin action `partnerOrders.confirmPayment` — that creates the user, page and subscription, records the first commission and returns a one-time set-password link; from then on the partner API returns only the customer's name, order number and commission (B2B-09). A later `subscription.activate` on that customer records a renewal commission row for 3 years unless the partner is `violation`/`deleted`; its `amount` stays NULL until the manager enters it, because the base of the 30% is pending (P-04) — do not auto-compute it.

**Publishing rule:** only `activateSubscription()` may publish a page. It is called by the admin actions `carts.confirmPayment` (first payment), `subscription.activate` (manual renewal, PERM-07) and `partnerOrders.confirmPayment`, and must later be called from the payment gateway's confirmed-payment webhook (gateway not chosen yet, P-08) — never from a beneficiary's browser request. The beneficiary's `cart.submit` only records a priced cart as `pending_payment`.

Endpoints: `auth/signup`, `auth/login`, `auth/reset-password` (`action: request | confirm`), `auth/email-code` (email confirmation for the signed-in user), `page/me`, `public-page`, `username/check`, `report`, `account`, `admin` and `partner` (all three `POST { action, ...params }`). `auth/email-code` takes `action: send | verify`.

**Files (note 53, 21 Oct 2026):** before each save the editor moves every inline image/PDF (logo, wallpaper photo and poster, link files, icons, card images) to R2 through `POST /api/media-upload` (`src/app/lib/mediaUpload.ts`); the name is the content's SHA-256 (`files/<userId>/<hash>.<ext>`), so a file is stored once, a changed file gets a new link, and later saves send only the link. `serveMedia` serves `/media/files/...` and keeps whole files in Cloudflare's edge cache. `page.ts` accepts these paths (`MEDIA_FILE_PATH`) beside data URLs, which still work: old pages move on their next save, and without R2 (plain Vite) the inline value is kept. 3 MB per file; quotas still wait on P-02.

**Partner selling (note 57, 21 Oct 2026) — two ways, both attributed to the partner:** (A) «بيع جديد» in the portal (`/partner/new`, `PartnerSale.tsx`, action `orders.start`): customer, plan, price, and «بدون تصميم» (order sent at once) or «مع تصميم» (a `draft` order designed in `/partner/edit/:id`, then `orders.markReady` / `orders.send`). Statuses: draft → (ready_at) → awaiting_payment → completed / cancelled; the payment window counts from `sent_at`; a draft's pay link shows nothing. Notes 61–64: the partner may add a design fee (`design_price`, 0 = free; added to the customer's total and to the partner's first commission); the partner's acknowledgement is stored word for word (`partner_ack_text`, time `terms_accepted_at`) and the customer accepts the terms on the pay link (`customer_terms_at`). A design order's link shows the real public page under a bar: «موافق، متابعة الدفع» (`order.approve`) or «طلب تعديل» (`order.requestChanges`, note emailed to the partner); saving the design again clears the approval, and payment needs a current approval. Test mode (DEMO_PRICES): partner floors 19/190 where unset, no emails (links shown), and `order.testPay` runs `completePartnerOrder()` — the same code as the employee's confirmation. Needs `database/phase16-partner-order-drafts.sql` (re-run it if run before). (B) The partner's own link `slug.onwan.link`: the admin sets it (`partners.setSlug`, which also reserves the name in `reserved_usernames`); `public-page` answers `{ partnerStorefront }` for it and the SPA shows the storefront, which hands over to `onwan.link/via/<id>?start=1` where the account is made; attribution is the server-side `partner_referrals` flow. Needs `database/phase17-partner-subdomains.sql`.

**Notes 65–75 (25 Oct 2026):** a partner's sale prices live only in «إعدادات التسعير» (`sale_monthly` / `sale_annual`); `orders.create` takes the price from there, never from the request, and an order keeps its price. «بيع جديد» checks the customer link live (`/api/username/check`); the server checks again when booking. Wrong verification codes answer **400** via `codeFailure()` (wrong / expired / too many tries) — a 401 would sign the user out. After an on-site payment the customer gets a code by email plus a password form (`welcome.sendCode` / `welcome.complete`), which also confirms the email once; the emailed set-password link stays as the fallback. Admin «إدارة الدخول» on a customer: `user.sendAccessLink` (any staff, after an identity check) and `user.tempPassword` (manager; shown once; `users.must_change_password`, needs `database/phase18-temporary-passwords.sql`; the customer must replace it via `password.replaceTemporary`). Saved design versions are filed under the account id (`onwan_design_history_user:<id>`), and `replacePageData` clears the previous account's saved copy and versions. A customer subdomain serves only `/`; any other path goes to the main site, and the public page has «إدارة صفحتي». Admin partner orders show each order's money; «المحصّل فعليًا» comes only from the `payments` ledger, and settlement policy is the owner's to decide.

**Stored-file cleanup (owner decision, 25 Oct 2026):** an hourly Worker cron (`scheduled` in `worker/index.ts`, `api/_lib/mediaCleanup.ts`) deletes R2 files nothing uses any more — used = a page, a button, an archived button or an open partner order. Grace from the day a file is first found unused: 30 days if it ever appeared in a save (`content_reviews` snapshots), so «الأشكال السابقة» keeps its images for a month; 24 hours if never saved (owner confirmed 24 h on 25 Oct 2026; a background video picked but not saved — images are only stored at save time). Deletions go to `media_cleanup_log`. Needs `database/phase19-media-cleanup.sql`; until then the cron fails without deleting anything.

**Limits (owner decisions, 25 Oct 2026):** REQ-016 200 MB of stored files per account (`api/_lib/storageQuota.ts`, counted from R2 on each upload). REQ-017 uploads and inline files must start with the bytes of their declared type (`shared/fileSignatures.ts`). REQ-018 at most 5 code emails per address per 24 h (all purposes) besides the 60 s gap. REQ-019 7 failed sign-ins in 15 minutes pause sign-in for that email/phone (customers, staff, partners; `api/_lib/loginGuard.ts`, table `login_failures`). REQ-025 the daily cron moves visits older than 365 days into `page_visits_monthly` in one statement; totals include them. Needs `database/phase21-limits-and-visits.sql`. REQ-026 (`api/_lib/retention.ts`, daily cron): operational records 14 days, `audit_log` 365 days, money never deleted (payments, commissions, and audit rows of financial actions). REQ-023 Cloudflare Stream (bought 25 Oct 2026): with `STREAM_API_TOKEN` set (plus the vars `CF_ACCOUNT_ID`, `STREAM_CUSTOMER_HOST` in wrangler.jsonc), background videos go browser → Stream (`api/stream-video.ts`: `create` a one-time upload URL tied to the owner in Stream metadata, then `status` until encoded and the MP4 download is ready); the page stores the `…/downloads/default.mp4` link, and saving checks the owner with Stream (`api/_lib/stream.ts`). Without the token, R2 as before. Unused Stream videos are deleted by `api/_lib/streamCleanup.ts` in the same cron (30 days after the first save without them if ever saved, else after the unsaved grace), apart from the R2 cleanup. Owner decisions 25 Oct 2026: payments only through the gateway (no cash; receiver = عنوان), a partner's «مع تصميم» fee is fixed at 39 SAR (`PARTNER_DESIGN_PRICE_SAR`). REQ-021: the Worker serves `/api/public-page` (data) and the subdomain HTML from the edge Cache API for 60 s (`cachedPublic` in `worker/index.ts`), still counting each data load as a visit via the `X-Onwan-Page` header; publishing (owner or staff) drops the copy (`api/_lib/publicCache.ts`; global purge only with `CF_ZONE_ID` + `CF_PURGE_TOKEN`, else other data centres refresh within 60 s). REQ-020: Turnstile is wired into sign-up, sign-in, password reset and partner apply/login, and stays off until `TURNSTILE_SECRET` and `VITE_TURNSTILE_SITE_KEY` are set. The owner handles on Cloudflare: creating the Turnstile widget, and REQ-022 / REQ-024 rate-limiting rules.

**Partners (note 54):** applying needs no password (`password_hash` is stored as `'!'`, which never matches); after approval a partner signs in with an emailed code (`login.sendCode` / `login.verifyCode`, OTP purpose `partner_login`); password sign-in remains for partners who have one. **Admin (note 55):** the «إعداد أول مرة» form is gone from the UI; the server `bootstrap` action is unchanged.

**Link save strategy:** `savePageData` deletes and re-inserts all `page_links` on every save, but keeps each link's id when the editor sends a valid UUID (new links get `crypto.randomUUID()` in the editor), so ids are stable across saves; a non-UUID or repeated id gets a new one.

**Save speed (note 28, Oct 2026):** `shared/pageTransfer.ts` — the editor sends inline data URLs that are unchanged since the last save (profile image, wallpaper value/poster, link file `url`, `customIcon`, `display.image`, links matched by id) as the `KEPT` marker; `savePageData` restores them from the stored row before validation and answers 409 if one has nothing to come from. With `slim: true` (`PATCH /api/page/me`) the response is slimmed the same way and the editor expands it from what it sent. An uploaded background video already verified by an earlier save is not checked against Blob storage again (uploads never overwrite). `save()` in `PageContext` runs one request at a time; edits made while it runs stay in the draft as unsaved. The local draft copy in `localStorage` is written after an 800 ms pause.

### Path alias

`@` maps to `./src` (configured in `vite.config.ts`).

### Styling

Tailwind CSS v4 (via `@tailwindcss/vite` plugin). Custom theme tokens in `src/styles/theme.css`. Fonts are self-hosted with `@fontsource` (no Google Fonts request, so blockers cannot strip them). `src/styles/fonts.css` loads only the interface fonts (Cairo, Tajawal). The 16 fonts a beneficiary can pick are `FONT_OPTIONS` (with `FONT_CATEGORIES`) in `PageContext.tsx`; each needs a loader in `src/app/lib/fonts.ts`, which loads a font only when a page uses it or the editor shows it. Font ids are stored in `typography_json` — never rename one. The UI uses Radix UI primitives with shadcn-style components in `src/app/components/ui/`.

### Deployment

Vercel. `vercel.json` rewrites all non-asset paths to `index.html` (SPA routing), and passes `/api/*` to the serverless functions. Pages on `name.onwan.link` need the wildcard domain `*.onwan.link` added to the Vercel project. SEO-01/02: `vercel.json` rewrites `/` on `name.onwan.link` to `api/public-page?render=html`, which serves the SPA shell (fetched from the main domain's `index.html`, override with `SPA_SHELL_URL`) with the entity's title, description and Open Graph tags; `?image=logo` serves the logo as a real image URL. The host-based rewrite has only been exercised by calling the function directly, not on a Vercel deployment — check it after the first deploy. The domain is hardcoded in that rewrite.

Section presentation: `display.sectionLayout` on section headings is list (default), grid, or carousel. Text paragraphs use `display.kind = text` with plain-text `body` / optional `bodyEn` (2000 characters each); rows have no URL and can be ordered, grouped and hidden. Existing display_json storage is reused.

Background video upload limit approved by owner: 20 MB (20 * 1024 * 1024 bytes), MP4/WebM. Stored in Cloudflare R2 (binding `MEDIA`, bucket `onwan-media`; owner decision 20 Oct 2026 to stay on Supabase + Cloudflare): `api/video-upload.ts` receives the file as the body and writes `wallpapers/<userId>/<uuid>.<ext>`; the page stores `/media/wallpapers/...`, which `serveMedia` in `worker/index.ts` serves on any host with byte ranges. Save verifies owner, size and MIME with R2 `head` once per file. Videos saved earlier with Vercel Blob URLs stay valid as saved. Uploads work under `npm run dev:worker`, not plain Vite. Background video files never go into page JSON. Content video is YouTube-only. Profile shape names: «صورة عريضة» (`hero`) is approved (20 Oct 2026).
