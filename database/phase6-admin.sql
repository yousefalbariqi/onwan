-- Phase 6: administration panel — staff, permissions, audit log (requirements
-- section 8 «مصفوفة الصلاحيات»). Safe to re-run. Apply after phase 5.

-- DEF-03 / PERM-18: a manager and employees. `permissions` holds the extra
-- authorisations the manager grants to an employee («الموظف المخوّل»).
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) not null unique,
  name varchar(120) not null,
  password_hash text not null,
  role varchar(20) not null default 'staff' check (role in ('manager', 'staff')),
  permissions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PERM-15 / AC-04: who did what and when. Rows outlive the staff member and
-- the customer they refer to, so names are copied in.
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id) on delete set null,
  staff_name text not null,
  action varchar(60) not null,
  target_type varchar(30),
  target_id text,
  target_label text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_created on audit_log (created_at desc);
create index if not exists idx_audit_log_target on audit_log (target_type, target_id, created_at desc);

-- DOMAIN-02: the old name redirects to the new one for 30 days, then it is free again.
create table if not exists username_redirects (
  old_username varchar(50) primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- MOD-05: the reason is internal; `suspension_message` is what visitors see.
alter table pages add column if not exists suspension_reason text;
alter table users add column if not exists banned_at timestamptz;

alter table page_reports add column if not exists handled_at timestamptz;
alter table page_reports add column if not exists handled_by text;
alter table support_requests add column if not exists handled_by text;
