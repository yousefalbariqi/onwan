-- Phase 5: align the schema with the «عنوان» requirements reference v1.0.
-- Safe to re-run. Requirement codes are noted next to each change.

-- ACCT-01 / ACCT-04 / MOD-06: password login, email confirmation, violation ban.
alter table users add column if not exists password_hash text;
alter table users add column if not exists email_verified_at timestamptz;
alter table users add column if not exists status varchar(20) not null default 'active';
alter table users add column if not exists ban_reason text;

alter table users drop constraint if exists users_status_chk;
alter table users add constraint users_status_chk check (status in ('active', 'banned'));

-- ACCT-02 / SUB-01 / SUB-07: a page is public only once payment is confirmed,
-- and the administration can suspend it with a message shown to visitors.
-- NOTE: every existing page becomes 'draft' (not public) after this migration.
-- To keep the pages that are already live, run once:
--   update pages set status = 'published';
alter table pages add column if not exists status varchar(20) not null default 'draft';
alter table pages add column if not exists suspension_message text;
alter table pages add column if not exists suspended_at timestamptz;

alter table pages drop constraint if exists pages_status_chk;
alter table pages add constraint pages_status_chk check (status in ('draft', 'published', 'suspended'));

-- SHARE-02: contact details exported in the VCF card. PAGE-17: font and size.
alter table pages add column if not exists contact_phone varchar(20);
alter table pages add column if not exists contact_email varchar(255);
alter table pages add column if not exists typography_json jsonb not null default '{}'::jsonb;

-- PAGE-06: hide a button without deleting it.
alter table page_links add column if not exists is_hidden boolean not null default false;

-- ACCT-04 / ACCT-06: one codes table for email confirmation and password reset.
alter table verification_codes add column if not exists purpose varchar(30) not null default 'verify_email';
alter table verification_codes add column if not exists attempts integer not null default 0;

create index if not exists idx_verification_codes_lookup
  on verification_codes (email, purpose, created_at desc)
  where used = false;

-- ACCT-03: names are subdomains (name.onwan.link), so they must be valid DNS
-- labels: no underscore, no leading/trailing hyphen.
alter table usernames drop constraint if exists usernames_format_chk;
alter table usernames
add constraint usernames_format_chk
check (
  username = lower(username)
  and username ~ '^(?=.{1,30}$)(?!.*--)[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
);

insert into reserved_usernames (username)
values
  ('www'), ('api'), ('app'), ('admin'), ('mail'), ('login'), ('signup'),
  ('builder'), ('preview'), ('support'), ('help'), ('partner'), ('partners'),
  ('dashboard'), ('static'), ('assets'), ('cdn'), ('nfc'), ('go'), ('onwan')
on conflict (username) do nothing;

-- PAY-01: prices are entered by the manager. They stay NULL until decided
-- (pending decision P-03) — the app never invents a price.
create table if not exists plans (
  plan varchar(20) primary key check (plan in ('monthly', 'annual')),
  price_sar numeric(10, 2),
  updated_at timestamptz not null default now()
);

insert into plans (plan) values ('monthly'), ('annual')
on conflict (plan) do nothing;

-- SUB-01 / PAGE-11: the beneficiary's current subscription (one account, one page).
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  plan varchar(20) not null check (plan in ('monthly', 'annual')),
  status varchar(20) not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'expired')),
  starts_at timestamptz,
  expires_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PAGE-01 / MOD-01 / AC-04: every save is published and queued for later review.
create table if not exists content_reviews (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  snapshot_json jsonb not null,
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  reason text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_reviews_status
  on content_reviews (status, created_at desc);

-- PUB-03: visitor report about the whole page, free text, no account.
create table if not exists page_reports (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references pages(id) on delete set null,
  username varchar(50) not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_page_reports_page on page_reports (page_id, created_at desc);

-- PAGE-12/13/14, DOMAIN-01, SUB-05, FILE-03, REQ-02/03: beneficiary requests.
-- status / due_at / internal_notes are for the administration only.
create table if not exists support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type varchar(30) not null check (type in (
    'message', 'pause_page', 'reactivate_page', 'delete_account',
    'change_subdomain', 'stop_renewal', 'more_storage', 'invoice'
  )),
  message text not null,
  status varchar(20) not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'stalled')),
  due_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_requests_status
  on support_requests (status, created_at desc);
