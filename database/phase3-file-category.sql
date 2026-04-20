alter table page_links
add column if not exists file_category varchar(20);

update page_links
set file_category = 'other'
where link_type = 'file' and (file_category is null or file_category = '');
