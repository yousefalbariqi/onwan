-- Geidea (KSA PGW) annual subscription checkout. Additive; keep rows permanently.
begin;
create table if not exists geidea_orders (
  id uuid primary key default gen_random_uuid(),           -- sent as merchantReferenceId
  user_id uuid not null references users(id),
  environment text not null check (environment in ('test','live')),
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'SAR',
  session_id text,
  geidea_order_id text unique,
  status text not null default 'open' check (status in ('open','paid','published','publication_failed','failed')),
  page_json jsonb not null,
  draft_saved_at timestamptz,
  username text not null,
  is_test boolean,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists geidea_orders_user on geidea_orders(user_id, created_at desc);
commit;
