-- Phase 7: print partners (B2B-01..16). Safe to re-run. Apply after phase 6.

-- B2B-01/02: one account per shop; inactive until the administration approves.
--   pending   → applied, waiting for approval
--   active    → may register customers
--   suspended → ordinary stop; renewal commissions keep accruing (B2B-15)
--   violation → stopped for breaking policy; future commissions stop, only the
--               manager may reactivate (B2B-15/16)
--   rejected  → application declined
--   deleted   → account removed by the manager; financial rows are kept (B2B-16)
create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  shop_name varchar(160) not null,
  contact_name varchar(120) not null,
  email varchar(255) not null unique,
  phone varchar(20) not null,
  city varchar(80),
  password_hash text not null,
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'violation', 'rejected', 'deleted')),
  status_reason text,
  -- B2B-10: the price the manager sets for this partner per plan. It is both
  -- the lowest price the partner may sell at and the base of their first-sale
  -- profit. NULL until the manager decides (P-03) — no orders for that plan.
  price_monthly numeric(10, 2),
  price_annual numeric(10, 2),
  -- B2B-12: renewal commission percentage; 30 by default, adjustable per partner.
  renewal_rate numeric(5, 2) not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists partner_order_number_seq start 1001;

-- B2B-03..09: a customer registered by a partner, until the payment completes.
create table if not exists partner_orders (
  id uuid primary key default gen_random_uuid(),
  order_number integer not null unique default nextval('partner_order_number_seq'),
  partner_id uuid not null references partners(id),
  customer_name varchar(160) not null,
  customer_phone varchar(20) not null,
  customer_email varchar(255) not null,
  username varchar(50) not null,
  plan varchar(20) not null check (plan in ('monthly', 'annual')),
  sale_price numeric(10, 2) not null,
  partner_price numeric(10, 2) not null,
  page_json jsonb not null default '{}'::jsonb,
  terms_accepted_at timestamptz not null,
  status varchar(20) not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'completed', 'cancelled')),
  payment_token text not null unique,
  payment_reference text,
  link_sent_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  -- Set on completion. The order row (name + number) survives the customer.
  user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_orders_partner on partner_orders (partner_id, created_at desc);
create index if not exists idx_partner_orders_username on partner_orders (username) where status = 'awaiting_payment';

-- B2B-10/12: what the partner earned. `amount` is NULL for a renewal whose
-- value is not decided yet: the base of the renewal percentage is a pending
-- decision (P-04), so the system records the renewal and the manager enters
-- the amount.
create table if not exists partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id),
  order_id uuid not null references partner_orders(id),
  kind varchar(20) not null check (kind in ('first', 'renewal')),
  amount numeric(10, 2),
  rate numeric(5, 2),
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_commissions_partner on partner_commissions (partner_id, created_at desc);

-- B2B-13/14: money is transferred outside the system; the manager records it.
create table if not exists partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id),
  amount numeric(10, 2) not null check (amount > 0),
  renewals_count integer not null default 0,
  note text,
  recorded_by text not null,
  paid_at timestamptz not null default now()
);

create index if not exists idx_partner_payouts_partner on partner_payouts (partner_id, paid_at desc);

-- B2B-05: the customer sets their own password from a one-time secure link.
create table if not exists account_setup_tokens (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- B2B-11: the customer's price as sold by the partner, kept for renewals.
alter table subscriptions add column if not exists custom_price numeric(10, 2);

insert into reserved_usernames (username)
values ('pay'), ('welcome'), ('reset-password'), ('plan-selection')
on conflict (username) do nothing;
