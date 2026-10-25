-- REQ-007..014. Run before deploying the matching Worker.
-- 200 MiB TOTAL, including the temporary 30 MiB allowance (owner clarification).
begin;
create table if not exists media_upload_events (
 id bigserial primary key, owner_id text not null,
 started_at timestamptz not null default clock_timestamp(),
 reserved_bytes bigint not null check(reserved_bytes >= 0)
);
create index if not exists media_upload_events_owner_time on media_upload_events(owner_id, started_at);
create table if not exists media_slot_state (
 owner_id text not null, slot text not null, value text not null,
 primary key(owner_id, slot)
);
create table if not exists media_replacement_counts (
 owner_id text not null, day date not null, replacements integer not null,
 primary key(owner_id, day)
);
create table if not exists media_deleted_keys (
 key text primary key, deleted_at timestamptz not null default now(), deleting boolean not null default true
);
alter table media_deleted_keys add column if not exists deleting boolean not null default true;
alter table media_upload_events enable row level security;
alter table media_slot_state enable row level security;
alter table media_replacement_counts enable row level security;
alter table media_deleted_keys enable row level security;

-- All reference writers share this lock; cleanup takes its exclusive form.
-- The account lock also serializes uploads and replacement counters.
create or replace function media_check_references(data jsonb) returns void
language plpgsql as $$
begin
 perform pg_advisory_xact_lock_shared(732022::bigint);
 if data::text ~* 'data:[^"[:space:]]*;base64,' then
   raise exception using errcode = 'P0001', message = 'media_inline_forbidden';
 end if;
 if exists(select 1 from regexp_matches(data::text, '/media/((?:files|wallpapers)/[A-Za-z0-9/._-]+)', 'g') m
           join media_deleted_keys d on d.key = m[1]) then
   raise exception using errcode = 'P0001', message = 'media_file_deleted';
 end if;
end $$;

create or replace function media_set_slot(owner text, slot_name text, new_value text) returns void
language plpgsql as $$
declare previous text; n integer; today date := (clock_timestamp() at time zone 'Asia/Riyadh')::date;
begin
 if coalesce(new_value,'') ~* '^data:' then return; end if;
 perform pg_advisory_xact_lock(hashtextextended('media:' || owner, 0));
 select value into previous from media_slot_state where owner_id = owner and slot = slot_name;
 if coalesce(previous, '') <> '' and coalesce(new_value, '') <> '' and previous <> new_value then
   insert into media_replacement_counts values(owner, today, 1)
   on conflict(owner_id, day) do update set replacements = media_replacement_counts.replacements + 1
   returning replacements into n;
   if n > 20 then raise exception using errcode = 'P0001', message = 'media_replacement_limit'; end if;
 end if;
 -- Emptying a slot does not reset its history (delete then add cannot bypass the limit).
 if coalesce(new_value, '') <> '' then
   insert into media_slot_state values(owner, slot_name, new_value)
   on conflict(owner_id, slot) do update set value = excluded.value;
 end if;
end $$;

create or replace function media_record_design(owner text, prefix text, design jsonb) returns void
language plpgsql as $$
declare l jsonb; ident text;
begin
 perform media_set_slot(owner, prefix || ':profile', design->>'profileImage');
 perform media_set_slot(owner, prefix || ':background', case when design#>>'{wallpaper,type}' in ('image','video') then design#>>'{wallpaper,value}' end);
 perform media_set_slot(owner, prefix || ':poster', case when design#>>'{wallpaper,type}' = 'video' then design#>>'{wallpaper,poster}' end);
 for l in select value from jsonb_array_elements(coalesce(design->'links', '[]'::jsonb)) loop
   ident := l->>'id';
   if coalesce(ident,'') = '' then continue; end if;
   perform media_set_slot(owner, prefix || ':link:' || ident || ':file', case when l->>'linkType' = 'file' then l->>'url' end);
   perform media_set_slot(owner, prefix || ':link:' || ident || ':icon', case when l->>'customIcon' not like 'icon:%' then l->>'customIcon' end);
   perform media_set_slot(owner, prefix || ':link:' || ident || ':image', l#>>'{display,image}');
 end loop;
end $$;

create or replace function media_reference_guard() returns trigger language plpgsql as $$
declare data jsonb := to_jsonb(new); owner text; prefix text; design jsonb;
begin
 perform media_check_references(data);
 if tg_table_name = 'pages' then
   owner := data->>'user_id'; prefix := 'page:' || (data->>'id');
   -- Only changed drafts count; publishing the same draft uses the same slots.
   if data->'draft_json' is not null and data->'draft_json' <> 'null'::jsonb
      and (tg_op = 'INSERT' or data->'draft_json' is distinct from to_jsonb(old)->'draft_json') then
     perform media_record_design(owner, prefix, data->'draft_json');
   end if;
   if tg_op = 'INSERT' or data->'profile_image_url' is distinct from to_jsonb(old)->'profile_image_url' then
     perform media_set_slot(owner, prefix || ':profile', data->>'profile_image_url');
   end if;
   if tg_op = 'INSERT' or data->'wallpaper_json' is distinct from to_jsonb(old)->'wallpaper_json' then
     perform media_set_slot(owner, prefix || ':background', case when data#>>'{wallpaper_json,type}' in ('image','video') then data#>>'{wallpaper_json,value}' end);
     perform media_set_slot(owner, prefix || ':poster', case when data#>>'{wallpaper_json,type}' = 'video' then data#>>'{wallpaper_json,poster}' end);
   end if;
 elsif tg_table_name = 'page_links' then
   select user_id::text into owner from pages where id = new.page_id;
   prefix := 'page:' || new.page_id::text || ':link:' || new.id::text;
   perform media_set_slot(owner, prefix || ':file', case when data->>'link_type' = 'file' then data->>'url' end);
   perform media_set_slot(owner, prefix || ':icon', case when data->>'custom_icon' not like 'icon:%' then data->>'custom_icon' end);
   perform media_set_slot(owner, prefix || ':image', data#>>'{display_json,image}');
 elsif tg_table_name = 'partner_orders' then
   perform media_record_design(data->>'partner_id', 'order:' || (data->>'id'), data->'page_json');
 end if;
 return new;
end $$;

do $$ declare t text; begin
 foreach t in array array['pages','page_links','partner_orders','deleted_links'] loop
   execute format('drop trigger if exists media_reference_guard on %I', t);
   execute format('create trigger media_reference_guard before insert or update on %I for each row execute function media_reference_guard()', t);
 end loop;
end $$;

-- Seed existing published slots without charging replacements.
insert into media_slot_state(owner_id, slot, value)
select p.user_id::text, 'page:' || p.id::text || ':profile', p.profile_image_url from pages p
where coalesce(p.profile_image_url,'') <> '' and p.profile_image_url !~* '^data:' on conflict do nothing;
insert into media_slot_state(owner_id, slot, value)
select p.user_id::text, 'page:' || p.id::text || ':' || v.slot, v.value from pages p
cross join lateral (values ('background', case when p.wallpaper_json->>'type' in ('image','video') then p.wallpaper_json->>'value' end), ('poster', p.wallpaper_json->>'poster')) v(slot,value)
where coalesce(v.value,'') <> '' and v.value !~* '^data:' on conflict do nothing;
insert into media_slot_state(owner_id, slot, value)
select p.user_id::text, 'page:' || p.id::text || ':link:' || l.id::text || ':' || v.slot, v.value
from page_links l join pages p on p.id = l.page_id
cross join lateral (values ('file', case when l.link_type = 'file' then l.url end), ('icon', case when l.custom_icon not like 'icon:%' then l.custom_icon end), ('image', l.display_json->>'image')) v(slot,value)
where coalesce(v.value,'') <> '' and v.value !~* '^data:' on conflict do nothing;
-- Existing partner designs are seeded through the same function, then counts reset.
do $$ declare r record; begin
 for r in select partner_id::text owner, id::text id, page_json from partner_orders where status in ('draft','awaiting_payment') loop
   perform media_record_design(r.owner, 'order:' || r.id, r.page_json);
 end loop;
end $$;
commit;
