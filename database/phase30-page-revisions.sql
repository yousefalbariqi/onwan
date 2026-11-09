-- Apply before deploying the revision-aware editor. Re-runnable.
begin;
alter table pages add column if not exists edit_revision bigint not null default 0;
alter table pages add column if not exists last_edit_operation text;
alter table pages add column if not exists published_revision bigint not null default 0;
alter table pages add column if not exists draft_base_revision bigint;
update pages set draft_base_revision=published_revision where draft_json is not null and draft_base_revision is null;
create or replace function page_edit_revision() returns trigger language plpgsql as $$
begin
  -- Approval/status changes must never discard someone's unpublished work.
  -- Approved-content changes make an existing draft a conflict to review.
  if (to_jsonb(new) - array['draft_json','draft_saved_at','draft_base_revision','edit_revision','published_revision','last_edit_operation','updated_at','status','suggested_username','suspension_reason','suspension_message','suspended_at'])
     is distinct from (to_jsonb(old) - array['draft_json','draft_saved_at','draft_base_revision','edit_revision','published_revision','last_edit_operation','updated_at','status','suggested_username','suspension_reason','suspension_message','suspended_at']) then
    new.published_revision = old.published_revision + 1;
  end if;
  if new.last_edit_operation is not distinct from old.last_edit_operation then
    new.last_edit_operation = null;
  end if;
  new.edit_revision = old.edit_revision + 1;
  return new;
end $$;
drop trigger if exists page_edit_revision_guard on pages;
create trigger page_edit_revision_guard before update on pages
for each row execute function page_edit_revision();
commit;
