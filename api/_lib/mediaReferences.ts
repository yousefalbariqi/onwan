// Shared by quota accounting and cleanup. Includes hidden and restorable content.
export const REFERENCED_SQL = `
  select distinct m[1] as key from (
    select coalesce(profile_image_url, '') || ' ' || coalesce(profile_style_json::text, '') || ' ' || coalesce(wallpaper_json::text, '') || ' ' || coalesce(typography_json::text, '') || ' ' || coalesce(to_jsonb(pages)->>'draft_json', '') as t from pages
    union all select coalesce(url, '') || ' ' || coalesce(custom_icon, '') || ' ' || coalesce(display_json::text, '') from page_links
    union all select page_json::text from nonprofit_quote_requests
    union all select link_json::text from deleted_links
    union all select page_json::text from partner_orders where status in ('draft', 'awaiting_payment')
  ) s, regexp_matches(s.t, '/media/((?:files|wallpapers)/[A-Za-z0-9/._-]+)', 'g') m`;

export const SAVED_SQL = `
  select distinct m[1] as key from content_reviews r,
    regexp_matches(r.snapshot_json::text, '/media/((?:files|wallpapers)/[A-Za-z0-9/._-]+)', 'g') m`;
