-- Phase 9: requirement changes of 13 Oct 2026 (newer than reference v1.0):
-- temporary name hold, one-time «صمّم لي», contact step before NFC shipping,
-- the registration cart. Safe to re-run. Apply after phase 8.

-- NEW-01 / ACCT-03 / AC-01.02 (amended): the chosen name is only HELD at
-- signup. It moves to `usernames` (fixed) when the payment is confirmed. The
-- beneficiary may change it before paying, which releases the previous hold.
-- `expires_at` is NULL while the hold duration is undecided (see the
-- `name_hold_days` setting): such a hold lasts until payment or change.
create table if not exists username_reservations (
  username varchar(50) primary key,
  user_id uuid not null unique references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- One place that answers «what is this customer's name, and is it fixed yet?».
create or replace view customer_names as
select
  u.id as user_id,
  coalesce(un.username, ur.username) as username,
  un.username is not null as is_fixed,
  ur.expires_at as hold_expires_at
from users u
left join usernames un on un.user_id = u.id
left join username_reservations ur on ur.user_id = u.id;

-- NEW-06 (replaces DES-03..08): «صمّم لي» is a one-time service that ends when
-- the design is approved. There is no edit balance and no validity period.
drop table if exists design_edits;
alter table design_packages drop column if exists edits_total;
alter table design_packages drop column if exists edits_used;
alter table design_packages drop column if exists expires_at;
delete from settings where key = 'design_edits_count';

-- NEW-07 / NFC-03 (amended): «نتواصل معك» before shipping.
alter table nfc_orders add column if not exists contacted_at timestamptz;
alter table nfc_orders add column if not exists contact_note text;
alter table nfc_orders drop constraint if exists nfc_orders_status_check;
alter table nfc_orders add constraint nfc_orders_status_check
  check (status in ('pending_payment', 'paid', 'contacted', 'shipped', 'cancelled'));
-- An order placed in the registration cart has no fixed address yet.
alter table nfc_orders alter column page_url drop not null;

create sequence if not exists registration_cart_number_seq start 9001;

-- NEW-04 / NEW-05: the registration cart — plan, «صمّم لي» and NFC pieces paid
-- together. Prices are frozen in the cart so the total the customer saw in
-- the summary is the total that is collected.
create table if not exists registration_carts (
  id uuid primary key default gen_random_uuid(),
  cart_number integer not null unique default nextval('registration_cart_number_seq'),
  user_id uuid not null references users(id) on delete cascade,
  plan varchar(20) not null check (plan in ('monthly', 'annual')),
  plan_price numeric(10, 2) not null,
  design_price numeric(10, 2),
  nfc_quantity integer not null default 0 check (nfc_quantity >= 0),
  nfc_unit_price numeric(10, 2),
  nfc_shipping_price numeric(10, 2),
  nfc_recipient_name varchar(160),
  nfc_recipient_phone varchar(20),
  nfc_city varchar(80),
  nfc_address text,
  total numeric(10, 2) not null,
  status varchar(20) not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'cancelled')),
  payment_reference text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- One open cart per customer.
create unique index if not exists idx_registration_carts_open
  on registration_carts (user_id) where status = 'pending_payment';
