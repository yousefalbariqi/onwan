-- Association accounts, private quote requests and manual-review workflow.
-- Apply before deploying the matching Worker. No payments or publication enabled.
begin;
alter table users add column if not exists account_kind text not null default 'standard';
alter table users add column if not exists nonprofit_activated_at timestamptz;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='users_account_kind_check') then
 alter table users add constraint users_account_kind_check check(account_kind in ('standard','nonprofit'));
 end if;
end $$;
create table if not exists nonprofit_quote_requests (
 id uuid primary key default gen_random_uuid(),
 request_number bigserial unique,
 user_id uuid not null unique references users(id),
 organization_name varchar(160) not null,
 contact_name varchar(160) not null,
 phone varchar(30) not null,
 email varchar(255) not null,
 notes text not null default '',
 page_json jsonb not null,
 status text not null default 'pending' check(status in ('pending','contacted','agreed','cancelled')),
 admin_notes text not null default '',
 email_status text not null default 'pending' check(email_status in ('pending','sending','sent','failed')),
 email_attempts integer not null default 0,
 email_attempted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table nonprofit_quote_requests enable row level security;
create index if not exists nonprofit_quote_status_time on nonprofit_quote_requests(status,created_at desc);
-- Submitted snapshots must be small references, never inline uploaded binaries.
create or replace function nonprofit_quote_media_guard() returns trigger language plpgsql as $$
begin perform media_check_references(new.page_json); return new; end $$;
drop trigger if exists nonprofit_quote_media_guard on nonprofit_quote_requests;
create trigger nonprofit_quote_media_guard before insert or update on nonprofit_quote_requests
for each row execute function nonprofit_quote_media_guard();
-- Enforce private preview even if somebody calls an ordinary checkout directly.
create or replace function nonprofit_publication_guard() returns trigger language plpgsql as $$
begin
 if (tg_table_name='pages' and new.status='published') or (tg_table_name='subscriptions' and new.status='active') then
   if exists(select 1 from users where id=new.user_id and account_kind='nonprofit' and nonprofit_activated_at is null) then
     raise exception using errcode='P0001', message='nonprofit_manual_activation';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists nonprofit_publication_guard on pages;
create trigger nonprofit_publication_guard before insert or update on pages for each row execute function nonprofit_publication_guard();
drop trigger if exists nonprofit_publication_guard on subscriptions;
create trigger nonprofit_publication_guard before insert or update on subscriptions for each row execute function nonprofit_publication_guard();
commit;
