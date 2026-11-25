-- Additive infrastructure. Keep orders, events and Paddle identities permanently.
begin;
create table if not exists paddle_checkout_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  environment text not null check(environment='sandbox'),
  price_id text not null,
  product_id text not null,
  transaction_id text unique,
  subscription_id text,
  customer_id text,
  status text not null default 'preparing' check(status in ('preparing','open','paid','published','publication_failed')),
  page_json jsonb not null,
  draft_saved_at timestamptz,
  username text not null,
  amount_minor text,
  currency_code text,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists paddle_one_checkout_per_user on paddle_checkout_orders(user_id,environment);
create table if not exists paddle_webhook_events (
  event_id text primary key,
  event_type text not null,
  occurred_at timestamptz not null,
  processed_at timestamptz not null default now()
);
create table if not exists paddle_customers (
  customer_id text primary key,
  email text,
  last_event_at timestamptz not null
);
create table if not exists paddle_subscriptions (
  subscription_id text primary key,
  customer_id text not null,
  status text not null,
  items jsonb not null,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  scheduled_change jsonb,
  last_event_at timestamptz not null
);
alter table subscriptions add column if not exists paddle_subscription_id text;
alter table paddle_checkout_orders enable row level security;
alter table paddle_webhook_events enable row level security;
alter table paddle_customers enable row level security;
alter table paddle_subscriptions enable row level security;
commit;
