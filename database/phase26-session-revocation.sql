-- Apply before deploying the session-revocation code. Existing sessions
-- remain valid until the account next resets its password.
alter table users add column if not exists session_version integer not null default 0;
