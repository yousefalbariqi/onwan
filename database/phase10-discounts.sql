-- Phase 10: discounts in the registration cart (PAY-02, PAY-03, PAY-04).
-- Safe to re-run. Apply after phase 9.

-- PAY-02: the general discount, set by the manager on the monthly plan, the
-- annual plan or both; it stays until the manager removes it (NULL = none).
alter table plans add column if not exists discount_percent numeric(5, 2)
  check (discount_percent is null or (discount_percent > 0 and discount_percent < 100));

-- PAY-03: codes with an expiry date and a usage limit. They reduce the plan
-- price only — never «صمّم لي»; NFC pieces are not covered either until that
-- is decided.
create table if not exists discount_codes (
  code varchar(40) primary key,
  kind varchar(10) not null check (kind in ('percent', 'amount')),
  value numeric(10, 2) not null check (value > 0),
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- What the customer was shown: list price, each discount, and the code used.
-- `plan_price` stays the amount actually charged for the plan.
alter table registration_carts add column if not exists plan_list_price numeric(10, 2);
alter table registration_carts add column if not exists general_discount numeric(10, 2) not null default 0;
alter table registration_carts add column if not exists discount_code varchar(40);
alter table registration_carts add column if not exists code_discount numeric(10, 2) not null default 0;
