-- Phase 12: beneficiary renewal invoices and the renewal portal.
-- Safe to re-run. Apply after phase 11.
--
-- A renewal invoice does NOT extend the subscription by itself. The future
-- payment webhook (or a staff payment confirmation) must call
-- activateSubscription after verified payment.

create sequence if not exists subscription_renewal_number_seq start 7001;

create table if not exists subscription_renewals (
  id uuid primary key default gen_random_uuid(),
  invoice_number integer not null unique default nextval('subscription_renewal_number_seq'),
  user_id uuid not null references users(id) on delete cascade,
  plan varchar(20) not null check (plan in ('monthly', 'annual')),
  amount numeric(10, 2) not null check (amount >= 0),
  status varchar(20) not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'cancelled')),
  due_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- Only one payment request should be visible to a beneficiary at a time.
create unique index if not exists idx_subscription_renewals_open
  on subscription_renewals (user_id) where status = 'pending_payment';
create index if not exists idx_subscription_renewals_status
  on subscription_renewals (status, due_at);
