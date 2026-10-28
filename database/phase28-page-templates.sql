-- Ready-made templates («القوالب الجاهزة»): page-wide design only — colours,
-- background, buttons, logo shape, fonts, sizes, corners and spacing; never
-- content. Built by the manager at /nonprofit/theme-builder; a new template
-- stays a draft until it is shown. Associations copy the design when they use
-- one, so editing or deleting a template never changes an existing page.
-- Apply before deploying.
create table if not exists page_templates (
  id uuid primary key default gen_random_uuid(),
  name varchar(60) not null,
  category varchar(40) not null default '',
  status varchar(10) not null default 'draft' check (status in ('draft', 'visible', 'hidden')),
  design jsonb not null,
  sort_order integer not null default 0,
  tried_count integer not null default 0,
  used_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists page_templates_visible on page_templates (status, sort_order, created_at desc);
