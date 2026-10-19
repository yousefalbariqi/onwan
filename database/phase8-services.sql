-- Phase 8: «صمّم لي», NFC orders, account changes, restorable deletions,
-- visit counts, English version, recorded payments. Safe to re-run. Apply after phase 7.

-- Values the manager enters from the panel. Nothing here has a default: the
-- numbers are pending decisions (P-01, P-03, P-12) and stay unset until entered.
--   design_edits_count  → edits included in one «صمّم لي» package
--   nfc_unit_price      → price of one NFC piece (SAR)
--   nfc_shipping_price  → shipping fee per order (SAR)
create table if not exists settings (
  key varchar(60) primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- DES-01..08. The package's numbers are copied in when it is paid, so a later
-- change of the settings never alters a package already sold.
create table if not exists design_packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status varchar(20) not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'cancelled')),
  price numeric(10, 2),
  edits_total integer,
  edits_used integer not null default 0,
  payment_reference text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  -- DES-04: the six months of edits start when the first design is approved.
  design_approved_at timestamptz,
  expires_at timestamptz
);

create index if not exists idx_design_packages_user on design_packages (user_id, requested_at desc);

-- DES-05: the detailed history stays with the administration.
create table if not exists design_edits (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references design_packages(id) on delete cascade,
  note text not null,
  recorded_by text not null,
  created_at timestamptz not null default now()
);

create sequence if not exists nfc_order_number_seq start 5001;

-- NFC-02/03, AC-13.
create table if not exists nfc_orders (
  id uuid primary key default gen_random_uuid(),
  order_number integer not null unique default nextval('nfc_order_number_seq'),
  user_id uuid references users(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  shipping_price numeric(10, 2) not null,
  total numeric(10, 2) not null,
  recipient_name varchar(160) not null,
  recipient_phone varchar(20) not null,
  city varchar(80) not null,
  address text not null,
  -- The address the pieces are programmed with, as it was when ordered.
  page_url text not null,
  status varchar(20) not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'shipped', 'cancelled')),
  payment_reference text,
  shipping_note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  shipped_at timestamptz
);

create index if not exists idx_nfc_orders_status on nfc_orders (status, created_at desc);

-- ACCT-05: a new email is held here until its ownership is proven.
alter table users add column if not exists pending_email varchar(255);

-- FILE-02 / PERM-19: a removed button or file is kept so the manager can
-- restore it. How long to keep it is a pending policy (P-09): nothing purges it.
create table if not exists deleted_links (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  link_json jsonb not null,
  deleted_by text not null,
  deleted_at timestamptz not null default now()
);

create index if not exists idx_deleted_links_page on deleted_links (page_id, deleted_at desc);

-- PAGE-15: a simple visit count, one row per page per day.
create table if not exists page_visits_daily (
  page_id uuid not null references pages(id) on delete cascade,
  day date not null,
  views integer not null default 0,
  primary key (page_id, day)
);

-- PAGE-16: manually entered English version.
alter table pages add column if not exists translations_json jsonb not null default '{}'::jsonb;
alter table page_links add column if not exists title_en varchar(255);

-- PAY-05 / PERM-14: every payment the administration confirms, kept after the
-- customer is gone.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  kind varchar(30) not null check (kind in ('subscription', 'partner_subscription', 'design', 'nfc')),
  amount numeric(10, 2) not null check (amount >= 0),
  reference text,
  label text,
  recorded_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_created on payments (created_at desc);
