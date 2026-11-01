-- Apply before deploying the association administration workflow.
-- Existing agreed requests remain unpaid; no page is activated by migration.
begin;
alter table nonprofit_quote_requests
  add column if not exists version integer not null default 1,
  add column if not exists assigned_staff_id uuid references staff(id) on delete set null,
  add column if not exists quote_json jsonb,
  add column if not exists sent_quote_json jsonb,
  add column if not exists quote_sent_at timestamptz,
  add column if not exists payment_id uuid unique references payments(id),
  add column if not exists paid_at timestamptz,
  add column if not exists activated_at timestamptz;
alter table nonprofit_quote_requests drop constraint if exists nonprofit_quote_requests_status_check;
alter table nonprofit_quote_requests add constraint nonprofit_quote_requests_status_check
  check(status in ('pending','contacted','agreed','quoted','paid','active','cancelled'));
create table if not exists nonprofit_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references nonprofit_quote_requests(id) on delete cascade,
  staff_id uuid references staff(id) on delete set null,
  staff_name text not null,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists nonprofit_events_request on nonprofit_request_events(request_id,created_at desc);
alter table nonprofit_request_events enable row level security;
-- Association hosting is the agreed duration, not a fabricated monthly or
-- annual retail subscription. Retail renewal/invoice jobs remain unchanged.
create table if not exists nonprofit_hosting (
  user_id uuid primary key references users(id),
  request_id uuid not null unique references nonprofit_quote_requests(id),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  months integer not null check(months between 1 and 120),
  check(expires_at > starts_at)
);
alter table nonprofit_hosting enable row level security;
commit;
