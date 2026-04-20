alter table page_links
add column if not exists link_type varchar(20) not null default 'url';

alter table page_links
add column if not exists file_name text;

alter table page_links
add column if not exists file_mime_type varchar(100);

alter table page_links
add column if not exists file_size integer;

update page_links
set link_type = 'url'
where link_type is null;
