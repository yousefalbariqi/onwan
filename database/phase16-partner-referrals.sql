-- Partner storefront prices and server-side attribution for self-service signups.
-- Apply after phase15; safe to re-run. No changes to existing account ownership.
alter table public.partners add column if not exists sale_monthly numeric(10,2);
alter table public.partners add column if not exists sale_annual numeric(10,2);

create table if not exists public.partner_referrals (
  user_id uuid primary key references public.users(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  sale_monthly numeric(10,2),
  sale_annual numeric(10,2),
  floor_monthly numeric(10,2),
  floor_annual numeric(10,2),
  converted_order_id uuid references public.partner_orders(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_partner_referrals_partner on public.partner_referrals(partner_id);
alter table public.partner_referrals enable row level security;
-- Access is through the server DB connection; no browser table policies.
