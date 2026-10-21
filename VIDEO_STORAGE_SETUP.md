# Background video uploads

Owner-approved limit: **20 MB** per MP4/WebM background video.

Videos are stored in **Cloudflare R2** through the Worker binding `MEDIA`
(bucket `onwan-media`, see `wrangler.jsonc`). No secret key is involved.

- `POST /api/video-upload` (owner session required) takes the file itself as the
  body, checks type and size, and stores it as `wallpapers/<user id>/<uuid>.<ext>`.
  Names are never reused, so a stored file never changes.
- The page saves the path `/media/wallpapers/...`. The Worker serves it on every
  host of the page, with byte ranges (needed by iPhone) and long-lived caching.
- Saving a page checks once, in R2, that the file exists, belongs to the owner,
  and is MP4/WebM within 20 MB; later saves of the same file skip that check.
- Videos uploaded earlier to Vercel Blob keep working as saved.

## Activation

1. Once: `npx wrangler r2 bucket create onwan-media`.
2. Deploy as usual (`npm run deploy:worker`).

Local testing: `npm run dev:worker` simulates R2 on your machine. Plain
`npm run dev` (Vite only) has no R2, so uploading answers with a clear 503.

Old videos are retained in storage on replacement/removal so page history and
restoration remain valid. Storage cleanup/retention is a separate pending policy.
