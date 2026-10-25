import { activateSubscription, getAccountSummary, isPlan } from './account.js';
import { completeCart } from './cartPayment.js';
import { pool } from './db.js';
import { HttpError } from './http.js';
import { getEnv } from './runtime.js';
import { recordPayment } from './services.js';
import type { SessionUser } from './session.js';

// Temporary owner-enabled checkout: real activation, no money collected.
export async function completeDemoPayment(params: any, user: SessionUser) {
  if (getEnv('DEMO_PAYMENT_ENABLED') !== 'true') {
    throw new HttpError(403, 'الدفع التجريبي غير مفعّل.');
  }
  const client = await pool.connect();
  let cartNumber: number | undefined;
  try {
    await client.query('begin');
    // Serialize repeat clicks, including the zero-price TEST checkout.
    await client.query('select id from users where id = $1 for update', [user.id]);
    if (params.invoice) {
      const result = await client.query(
        'select * from subscription_renewals where invoice_number::text = $1 and user_id = $2 for update',
        [String(params.invoice), user.id],
      );
      const invoice = result.rows[0];
      if (!invoice || invoice.status === 'cancelled') throw new HttpError(409, 'فاتورة التجديد غير متاحة.');
      if (invoice.status === 'pending_payment') {
        const reference = `DEMO:renewal:${invoice.id}`;
        await activateSubscription(user.id, invoice.plan, reference, client);
        await recordPayment(client, { userId: user.id, kind: 'subscription', amount: 0, reference, label: 'تجديد تجريبي دون تحصيل', recordedBy: 'دفع تجريبي' });
      }
    } else {
      let result;
      if (params.cart === 'TEST') {
        result = await client.query('select * from registration_carts where user_id = $1 order by created_at desc limit 1 for update', [user.id]);
        if (!result.rows[0]) {
          if (!isPlan(params.plan)) throw new HttpError(400, 'اختر الاشتراك الشهري أو السنوي.');
          const active = await client.query("select 1 from subscriptions where user_id = $1 and status = 'active' and expires_at > now()", [user.id]);
          if (active.rowCount) throw new HttpError(409, 'اشتراكك فعّال بالفعل. استخدم التجديد.');
          result = await client.query('insert into registration_carts (user_id, plan, plan_price, total) values ($1, $2, 0, 0) returning *', [user.id, params.plan]);
        }
      } else {
        result = await client.query('select * from registration_carts where cart_number::text = $1 and user_id = $2 for update', [String(params.cart ?? ''), user.id]);
      }
      const cart = result.rows[0];
      if (!cart || cart.status === 'cancelled') throw new HttpError(409, 'السلة غير متاحة.');
      cartNumber = cart.cart_number;
      if (cart.status === 'pending_payment') {
        await completeCart(client, cart, `DEMO:cart:${cart.id}`, 'دفع تجريبي', true);
      }
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  return { account: await getAccountSummary(user.id), cartNumber, demo: true };
}
