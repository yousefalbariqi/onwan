-- Owner decision (25 Oct 2026, to be known by everyone): subscription prices.
--   Monthly: 19.28 SAR per month
--   Annual: 192.24 SAR per year («الأفضل للعميل»)
-- Re-runnable. The manager can still change them later from the admin panel.
insert into plans (plan, price_sar) values ('monthly', 19.28), ('annual', 192.24)
on conflict (plan) do update set price_sar = excluded.price_sar, updated_at = now();
