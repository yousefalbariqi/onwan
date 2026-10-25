-- Note 42 (21 Oct 2026): defence in depth for customer data on Supabase.
--
-- The app never uses Supabase's public API (anon / authenticated keys): every
-- read and write goes through our API, which checks the session and filters by
-- the signed-in user's id. Supabase still exposes public tables through its
-- REST API to those keys unless Row Level Security is on. Enabling RLS with
-- no policies closes that door completely, while the app's own database role
-- (the table owner / a role with BYPASSRLS) keeps working unchanged.
--
-- Re-runnable. Run it as the same role the app connects with; it stops
-- without changing anything if that role would itself be locked out.

do $$
declare
  can_bypass boolean;
  t record;
begin
  select rolsuper or rolbypassrls into can_bypass from pg_roles where rolname = current_user;
  if not coalesce(can_bypass, false) and exists (
    select 1 from pg_tables where schemaname = 'public' and tableowner <> current_user
  ) then
    raise exception 'Role % neither bypasses RLS nor owns every table; the app would lose access. Nothing changed.', current_user;
  end if;

  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- The Supabase API roles get no direct access at all.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
  end if;
end $$;
