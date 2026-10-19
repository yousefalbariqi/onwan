-- Featured link cards and standalone section headings (owner decision).
-- Apply before deploying the API. Existing rows remain regular buttons.
alter table page_links add column if not exists display_json jsonb not null default '{}'::jsonb;
