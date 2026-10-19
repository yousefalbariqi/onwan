-- Phase 11: the entity's own domain (DOMAIN-03). Safe to re-run. Apply after phase 10.
-- The fee is the manager's setting `custom_domain_price` (no default: the fee
-- is a pending decision) — the service stays closed until it is entered.

--   pending_payment → requested, fee not confirmed yet
--   awaiting_dns    → paid; the customer has to add the DNS record
--   dns_verified    → the record points at us (this is the proof of control
--                     DOMAIN-03 asks for); waiting to be attached to hosting
--   active          → the page answers on this domain
--   removed         → cancelled or taken down
create table if not exists custom_domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  domain varchar(253) not null,
  price numeric(10, 2) not null,
  status varchar(20) not null default 'pending_payment'
    check (status in ('pending_payment', 'awaiting_dns', 'dns_verified', 'active', 'removed')),
  payment_reference text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  verified_at timestamptz,
  activated_at timestamptz
);

-- A domain belongs to one live request at a time; a customer has one.
create unique index if not exists idx_custom_domains_domain on custom_domains (domain) where status <> 'removed';
create unique index if not exists idx_custom_domains_user on custom_domains (user_id) where status <> 'removed';

-- The domain can be bought inside the first-registration cart. Freeze both
-- the requested name and the quoted fee so later pricing changes do not alter
-- an already approved total.
alter table registration_carts add column if not exists custom_domain varchar(253);
alter table registration_carts add column if not exists domain_price numeric(10, 2);

alter table payments drop constraint if exists payments_kind_check;
alter table payments add constraint payments_kind_check
  check (kind in ('subscription', 'partner_subscription', 'design', 'nfc', 'domain'));
