import { pool } from './db.js';
import { SAVED_GRACE_DAYS, UNSAVED_GRACE_DAYS } from './mediaCleanup.js';
import { deleteStreamVideo, listStreamVideos, streamConfig } from './stream.js';

// REQ-023 + the owner's cleanup rule, for Cloudflare Stream videos: a video
// nothing uses any more is deleted 30 days after it stopped being used if it
// was ever saved, or 24 hours after upload if it never was. «Stopped being
// used» is the first save of that page that no longer had it. Kept apart from
// the R2 cleanup so neither can disturb the other.
const DAY = 86_400_000;
const UID = '[a-f0-9]{32}';

const REFERENCED = `
  select distinct m[1] as uid from (
    select coalesce(wallpaper_json::text, '') || ' ' || coalesce(to_jsonb(pages)->>'draft_json', '') as t from pages
    union all select link_json::text from deleted_links
    union all select page_json::text from partner_orders where status in ('draft', 'awaiting_payment')
  ) s, regexp_matches(s.t, 'cloudflarestream\\.com/(${UID})/', 'g') m`;

// When each saved video stopped appearing in its page's saves.
const UNUSED_SINCE = `
  with hits as (
    select r.page_id, m[1] as uid, max(r.created_at) as last_with
    from content_reviews r, regexp_matches(r.snapshot_json::text, 'cloudflarestream\\.com/(${UID})/', 'g') m
    group by 1, 2
  )
  select h.uid,
         coalesce((select min(r.created_at) from content_reviews r where r.page_id = h.page_id and r.created_at > h.last_with), h.last_with) as since
  from hits h`;

export async function runStreamCleanup(now = new Date()) {
  if (!streamConfig()) return { skipped: 'stream off' };
  const videos = await listStreamVideos();
  const used = new Set((await pool.query<{ uid: string }>(REFERENCED)).rows.map((row) => row.uid));
  const since = new Map<string, Date>((await pool.query<{ uid: string; since: string }>(UNUSED_SINCE)).rows.map((row) => [row.uid, new Date(row.since)]));
  const due = videos.filter((video) => {
    if (used.has(video.uid)) return false;
    const saved = since.get(video.uid);
    const from = saved ?? new Date(video.created);
    return now.getTime() - from.getTime() >= (saved ? SAVED_GRACE_DAYS : UNSAVED_GRACE_DAYS) * DAY;
  });
  for (const video of due) {
    await deleteStreamVideo(video.uid);
    await pool.query("insert into media_cleanup_log (key, unused_since) values ($1, $2)", [`stream/${video.uid}`, since.get(video.uid) ?? new Date(video.created)]).catch(() => undefined);
  }
  return { videos: videos.length, deleted: due.length };
}
