-- Note 72 (25 Oct 2026): a temporary password set by a manager must be
-- replaced by the customer at their next sign-in. Re-runnable; no data changes.
alter table users add column if not exists must_change_password boolean not null default false;
