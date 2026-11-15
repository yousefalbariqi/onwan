-- Apply after phase32, before deploying account completion.
begin;
alter table creation_email_drafts add column if not exists account_user_id uuid references users(id) on delete cascade;
alter table creation_email_drafts add column if not exists account_completed_at timestamptz;
alter table creation_email_drafts add column if not exists terms_accepted_at timestamptz;
alter table creation_email_drafts add column if not exists terms_version text;
commit;
