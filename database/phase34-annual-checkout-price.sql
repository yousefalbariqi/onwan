-- Owner-approved annual list price, inclusive of VAT. Apply explicitly as a
-- pricing change; this does NOT configure a payment provider or recurring billing.
-- The monthly plan remains for existing subscriptions/renewals.
begin;
insert into plans(plan,price_sar) values('annual',180)
on conflict(plan) do update set price_sar=180,updated_at=now();
commit;
