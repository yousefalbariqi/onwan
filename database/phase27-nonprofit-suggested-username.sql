-- Apply before deploying. Suggestions are deliberately non-unique and
-- never consulted by availability checks or public routing.
alter table pages add column if not exists suggested_username varchar(30);
