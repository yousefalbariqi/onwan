-- 25 Oct 2026 (REQ-019, REQ-025). Re-runnable; no data is lost.

-- REQ-019: failed sign-ins, to pause an account after 7 within 15 minutes.
create table if not exists login_failures (
  id bigserial primary key,
  scope varchar(20) not null,          -- 'customer' | 'staff' | 'partner'
  identifier varchar(255) not null,    -- the email or phone that was tried
  failed_at timestamptz not null default now()
);
create index if not exists idx_login_failures_lookup on login_failures (scope, identifier, failed_at desc);
alter table login_failures enable row level security;

-- REQ-025: visits older than 365 days are kept per month instead of per day.
create table if not exists page_visits_monthly (
  page_id uuid not null references pages(id) on delete cascade,
  month date not null,
  views integer not null default 0,
  primary key (page_id, month)
);
alter table page_visits_monthly enable row level security;
