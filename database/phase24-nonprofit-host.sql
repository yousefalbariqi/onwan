-- Step 1 only: reserve the dedicated nonprofit landing hostname.
-- Fail safely if someone already owns the name; never take over an account.
begin;
lock table usernames, username_reservations, partners, partner_orders, custom_domains in share row exclusive mode;
do $$ begin
 if exists(select 1 from usernames where username = 'nonprofit')
 or exists(select 1 from partners where to_jsonb(partners)->>'slug' = 'nonprofit')
 or exists(select 1 from customer_names where username = 'nonprofit')
 or exists(select 1 from partner_orders where username = 'nonprofit' and status in ('draft','awaiting_payment'))
 or exists(select 1 from custom_domains where domain = 'nonprofit.onwan.link') then
   raise exception 'nonprofit is already assigned; resolve ownership before enabling the dedicated host';
 end if;
end $$;
insert into reserved_usernames(username) values('nonprofit') on conflict do nothing;
commit;
