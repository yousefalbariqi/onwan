import type { PoolClient } from 'pg';
import { activateSubscription } from './account.js';
import { getEnv } from './runtime.js';
import { recordPayment } from './services.js';

// The caller locks the cart and wraps this in a transaction.
export async function completeCart(client: PoolClient, cart: any, reference: string, recordedBy: string, demo = false) {
  const label = `سلة #${cart.cart_number}`;
  const pay = (kind: 'subscription' | 'design' | 'nfc' | 'domain', amount: number) =>
    recordPayment(client, { userId: cart.user_id, kind, amount: demo ? 0 : amount, reference, label: demo ? `تجريبي — ${label}` : label, recordedBy });

  await activateSubscription(cart.user_id, cart.plan, `${label}: ${reference}`, client);
  await pay('subscription', Number(cart.plan_price));

  if (cart.design_price !== null) {
    await client.query(
      `insert into design_packages (user_id, status, price, payment_reference, paid_at)
       values ($1, 'active', $2, $3, now())`,
      [cart.user_id, cart.design_price, reference],
    );
    await pay('design', Number(cart.design_price));
  }

  if (cart.nfc_quantity > 0) {
    const nfcTotal = cart.nfc_quantity * Number(cart.nfc_unit_price) + Number(cart.nfc_shipping_price);

    // The address is the name that was just fixed by this payment.
    await client.query(
      `insert into nfc_orders
         (user_id, quantity, unit_price, shipping_price, total, recipient_name, recipient_phone, city, address,
          page_url, status, payment_reference, paid_at)
       select $1, $2, $3, $4, $5, $6, $7, $8, $9, 'https://' || un.username || '.' || $10, 'paid', $11, now()
       from usernames un where un.user_id = $1`,
      [
        cart.user_id,
        cart.nfc_quantity,
        cart.nfc_unit_price,
        cart.nfc_shipping_price,
        nfcTotal,
        cart.nfc_recipient_name,
        cart.nfc_recipient_phone,
        cart.nfc_city,
        cart.nfc_address,
        getEnv('ROOT_DOMAIN') || 'onwan.link',
        reference,
      ],
    );
    await pay('nfc', nfcTotal);
  }

  if (cart.custom_domain) {
    // Paid for here; the customer connects it from their account next.
    await client.query(
      `insert into custom_domains (user_id, domain, price, status, payment_reference, paid_at)
       values ($1, $2, $3, 'awaiting_dns', $4, now())`,
      [cart.user_id, cart.custom_domain, cart.domain_price, reference],
    );
    await pay('domain', Number(cart.domain_price));
  }

  await client.query(
    "update registration_carts set status = 'paid', paid_at = now(), payment_reference = $2 where id = $1",
    [cart.id, reference],
  );

  // PAY-03: a use is counted when it is paid for, not when it is typed.
  if (cart.discount_code) {
    await client.query('update discount_codes set used_count = used_count + 1 where code = $1', [cart.discount_code]);
  }

}
