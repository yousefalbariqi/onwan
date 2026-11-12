-- One durable creation-start event per association; independent of quote requests.
create table if not exists nonprofit_creation_starts (
 user_id uuid primary key references users(id) on delete cascade,
 organization_name varchar(160) not null,
 contact_name varchar(160),
 email varchar(254) not null,
 phone varchar(30),
 created_at timestamptz not null default now(),
 email_status text not null default 'pending' check (email_status in ('pending','sending','sent','failed')),
 email_attempts integer not null default 0,
 email_attempted_at timestamptz
);

create index if not exists nonprofit_creation_starts_pending_idx
 on nonprofit_creation_starts(created_at) where email_status <> 'sent' and email_attempts < 5;
