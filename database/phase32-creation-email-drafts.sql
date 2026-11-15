-- Email-verified creation drafts are separate from paid/customer accounts.
-- Apply after phase31 and before deploying this feature. Re-runnable.
begin;
create table if not exists creation_email_drafts (
 id uuid primary key default gen_random_uuid(),
 email varchar(255) not null,
 client_key uuid not null,
 page_json jsonb,
 revision bigint not null default 0,
 last_operation text,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(email, client_key)
);
create index if not exists creation_email_drafts_email_latest on creation_email_drafts(email, updated_at desc);
alter table creation_email_drafts enable row level security;
-- Server-only access: no browser policies.
create or replace function creation_draft_media_guard() returns trigger language plpgsql as $$
begin
 if new.page_json is not null then
   perform media_check_references(new.page_json);
   perform media_record_design(new.id::text, 'creation', new.page_json);
 end if;
 return new;
end $$;
drop trigger if exists creation_draft_media_guard on creation_email_drafts;
create trigger creation_draft_media_guard before insert or update of page_json on creation_email_drafts
 for each row execute function creation_draft_media_guard();
commit;
