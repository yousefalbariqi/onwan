alter table pages
add column if not exists extracted_colors_json jsonb not null default '[]'::jsonb;

alter table page_links
add column if not exists icon_style varchar(20);

alter table page_links
add column if not exists text_position varchar(20);
