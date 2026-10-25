-- Owner decision (25 Oct 2026): stored files nothing uses any more are deleted
-- 30 days after they were first found unused if they were ever saved, or 3
-- days if they never were. Re-runnable; no data changes.

-- When each unused file was first noticed; a file used again leaves the list.
create table if not exists media_orphans (
  key text primary key,
  first_seen timestamptz not null default now()
);

-- What the daily cleanup deleted, for review.
create table if not exists media_cleanup_log (
  id bigserial primary key,
  key text not null,
  unused_since timestamptz not null,
  deleted_at timestamptz not null default now()
);

alter table media_orphans enable row level security;
alter table media_cleanup_log enable row level security;
