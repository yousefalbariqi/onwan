-- Note 57 (21 Oct 2026): «بيع جديد» with an optional design step.
-- A partner order may now start as a 'draft' (designed in the editor, not yet
-- sent), be marked ready, then be sent; the payment window (3 days) counts
-- from the send. Re-runnable; changes no existing order.

alter table partner_orders drop constraint if exists partner_orders_status_check;
alter table partner_orders add constraint partner_orders_status_check
  check (status in ('draft', 'awaiting_payment', 'completed', 'cancelled'));

alter table partner_orders add column if not exists with_design boolean not null default false;
alter table partner_orders add column if not exists ready_at timestamptz;
alter table partner_orders add column if not exists sent_at timestamptz;
alter table partner_orders alter column link_sent_at drop not null;
-- Note 61: the partner's own price for designing the page (0 = free).
alter table partner_orders add column if not exists design_price numeric(10,2) not null default 0;
-- Note 62: the partner's acknowledgement as worded when given (its time is
-- terms_accepted_at), and when the customer accepted the terms on the pay link.
alter table partner_orders add column if not exists partner_ack_text text;
alter table partner_orders add column if not exists customer_terms_at timestamptz;
-- Note 64: the customer reviews the design first — approves it, or asks for
-- changes. A design edited after approval needs approving again.
alter table partner_orders add column if not exists design_updated_at timestamptz;
alter table partner_orders add column if not exists approved_at timestamptz;
alter table partner_orders add column if not exists revision_requested_at timestamptz;
alter table partner_orders add column if not exists revision_note text;

-- Orders made before this change were sent when they were created.
update partner_orders set sent_at = created_at where sent_at is null and status <> 'draft';
