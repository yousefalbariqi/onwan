-- Publish first, collect manually. Cart/payment state remains pending_payment.
begin;
alter table registration_carts add column if not exists manual_published_at timestamptz;
alter table registration_carts add column if not exists manual_payment_url text;
alter table registration_carts add column if not exists manual_invoice_url text;
commit;
