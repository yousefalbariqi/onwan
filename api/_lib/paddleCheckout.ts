import { pool } from './db.js';
import { HttpError } from './http.js';
import { paddleClient, paddleConfig } from './paddle.js';
import { getPageDataByUserId } from './page.js';
import { getAccountSummary } from './account.js';
import { fulfillPaddleOrder } from './paddleFulfillment.js';
import type { SessionUser } from './session.js';
import type { CurrencyCode } from '@paddle/paddle-node-sdk';

// Only server-created transaction IDs can be fulfilled. Never map by client email/customData.
export async function startPaddleCheckout(params: {currencyCode?:string}, user: SessionUser) {
  const config = paddleConfig();
  const paddle = paddleClient();
  const price = await paddle.prices.get(config.priceId);
  // Currency is a display preference only; Paddle still calculates every amount from the catalog.
  const currency=params.currencyCode ?? price.unitPrice.currencyCode;
  if(!('USD EUR GBP JPY AUD CAD CHF CLP HKD SGD SEK ARS BRL CNY COP CZK DKK HUF ILS INR KRW MXN NOK NZD PEN PLN RUB THB TRY TWD UAH VND ZAR'.split(' ').includes(currency))) throw new HttpError(400,'عملة الدفع غير مدعومة.');
  if (price.status !== 'active' || price.billingCycle?.interval !== 'year' || price.billingCycle.frequency !== 1 || price.trialPeriod) {
    throw new HttpError(409, 'سعر التجربة يجب أن يكون اشتراكًا سنويًا فعّالًا بدون فترة مجانية.');
  }
  const client = await pool.connect();
  let order: any;
  try {
    await client.query('begin');
    const owner = (await client.query('select account_kind,email_verified_at,status from users where id=$1 for update', [user.id])).rows[0];
    if (!owner || owner.status !== 'active' || !owner.email_verified_at || owner.account_kind === 'nonprofit') throw new HttpError(403, 'أكمل حسابك وتأكيد بريدك قبل الدفع.');
    order = (await client.query('select * from paddle_checkout_orders where user_id=$1 and environment=$2 for update', [user.id,config.environment])).rows[0];
    if (!order) {
      if ((await client.query("select 1 from subscriptions where user_id=$1 and status='active' and expires_at>now()",[user.id])).rowCount) throw new HttpError(409,'اشتراكك فعّال بالفعل.');
      const page = (await client.query('select status,draft_json,draft_saved_at from pages where user_id=$1 for update',[user.id])).rows[0];
      const data = page?.draft_json ?? await getPageDataByUserId(user.id,client);
      const name = (await client.query('select username from customer_names where user_id=$1',[user.id])).rows[0]?.username;
      if (!page || page.status==='suspended' || !name || !data?.name?.trim() || data.editorForm) throw new HttpError(409,'أكمل صفحتك واختر رابطها واحفظها قبل الدفع.');
      // Extras and partner orders retain their dedicated purchase paths.
      if ((await client.query(`select 1 from registration_carts where user_id=$1 and status='pending_payment'
        and (plan<>'annual' or design_price is not null or nfc_quantity>0 or custom_domain is not null or discount_code is not null)`,[user.id])).rowCount
        || (await client.query('select 1 from partner_referrals where user_id=$1',[user.id])).rowCount) throw new HttpError(409,'راجع طلبك الحالي عبر مساره المخصص قبل الدفع.');
      order=(await client.query(`insert into paddle_checkout_orders(user_id,environment,price_id,product_id,page_json,draft_saved_at,username)
        values($1,$2,$3,$4,$5::jsonb,$6,$7) returning *`,[user.id,config.environment,price.id,price.productId,JSON.stringify(data),page.draft_saved_at,name])).rows[0];
    } else if(!order.paid_at) {
      const page=(await client.query('select status,draft_json,draft_saved_at from pages where user_id=$1 for update',[user.id])).rows[0];
      const data=page?.draft_json ?? await getPageDataByUserId(user.id,client);
      const name=(await client.query('select username from customer_names where user_id=$1',[user.id])).rows[0]?.username;
      if(!page || page.status==='suspended' || !name || !data?.name?.trim() || data.editorForm) throw new HttpError(409,'أكمل صفحتك واحفظها قبل الدفع.');
      // Resume the same transaction with the latest saved design, never start a second payable order.
      await client.query('update paddle_checkout_orders set page_json=$2::jsonb,draft_saved_at=$3,username=$4,updated_at=now() where id=$1',
        [order.id,JSON.stringify(data),page.draft_saved_at,name]);
    }
    await client.query('commit');
  } catch(error) { await client.query('rollback'); throw error; } finally { client.release(); }
  if (order.status==='published' || order.status==='paid' || order.status==='publication_failed') return { orderId:order.id, state:order.status };
  if (order.transaction_id) return { orderId:order.id, transactionId:order.transaction_id, priceId:order.price_id, state:'open' };
  // Claim once. A network timeout is ambiguous: don't silently create a second chargeable transaction.
  const claimed=await pool.query("update paddle_checkout_orders set status='open',updated_at=now() where id=$1 and status='preparing' returning id",[order.id]);
  if (!claimed.rowCount) throw new HttpError(409,'طلبك قيد التجهيز. لا تُعد الدفع؛ حدّث الصفحة للتحقق.', 'paddle_preparing');
  try {
    const transaction=await paddle.transactions.create({ items:[{priceId:order.price_id,quantity:1}], currencyCode:currency as CurrencyCode, collectionMode:'automatic', customData:{onwanOrderId:order.id} });
    await pool.query('update paddle_checkout_orders set transaction_id=$2,updated_at=now() where id=$1',[order.id,transaction.id]);
    return { orderId:order.id, transactionId:transaction.id, priceId:order.price_id, state:'open' };
  } catch {
    throw new HttpError(503,'تعذر تأكيد تجهيز عملية الدفع. طلبك محفوظ؛ لا تنشئ دفعة أخرى. تواصل مع الدعم إذا استمر التأخير.','paddle_preparing');
  }
}

export async function paddleCheckoutStatus(params: any,user: SessionUser) {
  paddleConfig();
  const find=()=>pool.query(`select id,status,username,paid_at,fulfilled_at from paddle_checkout_orders where user_id=$1
    and environment='sandbox' and ($2::text is null or id::text=$2) order by created_at desc limit 1`,[user.id,params.order ? String(params.order):null]);
  let order=(await find()).rows[0];
  if (order?.status==='paid' || order?.status==='publication_failed') {
    await fulfillPaddleOrder(order.id).catch(()=>undefined);
    order=(await find()).rows[0];
  }
  return { state:order?.status ?? 'not_found', orderId:order?.id ?? null,
    ...(order?.status==='published' ? {account:await getAccountSummary(user.id)}:{}),
    username:order?.status==='published' ? order.username:null, paymentConfirmed:Boolean(order?.paid_at), sandbox:true };
}
