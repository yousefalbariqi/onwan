-- Note 57 (21 Oct 2026): each partner may get its own link, e.g.
-- bawariq.onwan.link. The name shares the namespace of customer pages, so
-- the API also reserves it in reserved_usernames when it is assigned.
-- Re-runnable; changes no existing data.

alter table partners add column if not exists slug varchar(30);
create unique index if not exists partners_slug_key on partners (slug) where slug is not null;
