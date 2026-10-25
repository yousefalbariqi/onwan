-- REQ-015 (25 Oct 2026): the editor keeps a server-side draft of unpublished
-- edits (saved on its own, merged after a pause), and every account may save
-- at most 200 times a day (drafts and publishing together). Re-runnable.

alter table pages add column if not exists draft_json jsonb;
alter table pages add column if not exists draft_saved_at timestamptz;

create table if not exists page_save_counts (
  user_id uuid not null references users(id) on delete cascade,
  day date not null,
  saves integer not null default 0,
  primary key (user_id, day)
);
alter table page_save_counts enable row level security;
