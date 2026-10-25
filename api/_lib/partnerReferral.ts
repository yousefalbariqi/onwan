import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from './db.js';
import { HttpError } from './http.js';

type Queryable = Pick<PoolClient, 'query'>;
export async function loadStorefront(partnerId: unknown, db: Queryable = pool) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(partnerId ?? ''))) throw new HttpError(404, 'رابط الشريك غير صالح.');
  const result = await db.query('select id, shop_name, status, price_monthly, price_annual, sale_monthly, sale_annual from partners where id = $1', [partnerId]);
  const row = result.rows[0];
  if (!row || row.status !== 'active') throw new HttpError(404, 'رابط البيع غير متاح حاليًا.');
  const price = (sale: unknown, floor: unknown) => sale != null && floor != null && Number(sale) >= Number(floor) ? Number(sale) : null;
  return { ...row, monthly: price(row.sale_monthly, row.price_monthly), annual: price(row.sale_annual, row.price_annual) };
}

export async function attachReferral(db: Queryable, userId: string, partnerId: unknown) {
  if (!partnerId) return;
  const partner = await loadStorefront(partnerId, db);
  if (partner.monthly === null && partner.annual === null) throw new HttpError(409, 'لم يحدد الشريك أسعار رابط البيع بعد.');
  await db.query(`insert into partner_referrals (user_id, partner_id, sale_monthly, sale_annual, floor_monthly, floor_annual)
    values ($1, $2, $3, $4, $5, $6)`, [userId, partner.id, partner.monthly, partner.annual, partner.price_monthly, partner.price_annual]);
}

export async function getReferralOffer(userId: string) {
  const result = await pool.query(`select r.*, p.shop_name, p.status as partner_status from partner_referrals r
    join partners p on p.id = r.partner_id where r.user_id = $1 and r.converted_order_id is null`, [userId]);
  return result.rows[0] ?? null;
}

// Runs inside the same transaction as activation: only the first purchase earns attribution.
export async function convertReferral(db: Queryable, userId: string, plan: 'monthly' | 'annual', paymentReference: string) {
  const result = await db.query(`select r.*, p.status as partner_status from partner_referrals r join partners p on p.id = r.partner_id
    where r.user_id = $1 and r.converted_order_id is null for update of r`, [userId]);
  const referral = result.rows[0];
  if (!referral) return;
  if (['violation', 'deleted', 'rejected'].includes(referral.partner_status)) throw new HttpError(409, 'عرض الشريك غير متاح. تواصل مع الإدارة.');
  const sale = plan === 'annual' ? referral.sale_annual : referral.sale_monthly;
  const floor = plan === 'annual' ? referral.floor_annual : referral.floor_monthly;
  if (sale == null || floor == null) throw new HttpError(409, 'هذه الباقة غير متاحة من رابط الشريك.');
  const order = await db.query(`insert into partner_orders (partner_id, customer_name, customer_phone, customer_email, username,
      plan, sale_price, partner_price, page_json, terms_accepted_at, payment_token, status, completed_at, user_id, payment_reference)
    select $2, coalesce(nullif(p.display_name, ''), un.username), u.phone, u.email, un.username,
      $3, $4, $5, '{}'::jsonb, r.created_at, $6, 'completed', now(), u.id, $7
    from users u join pages p on p.user_id = u.id join usernames un on un.user_id = u.id
    join partner_referrals r on r.user_id = u.id where u.id = $1 returning id`,
    [userId, referral.partner_id, plan, sale, floor, crypto.randomBytes(24).toString('base64url'), paymentReference]);
  if (!order.rows[0]) throw new HttpError(409, 'تعذر ربط عملية الشراء بالشريك.');
  await db.query("insert into partner_commissions (partner_id, order_id, kind, amount) values ($1, $2, 'first', $3)",
    [referral.partner_id, order.rows[0].id, paymentReference.includes('DEMO:') ? 0 : Number(sale) - Number(floor)]);
  await db.query('update partner_referrals set converted_order_id = $2 where user_id = $1', [userId, order.rows[0].id]);
  await db.query('update subscriptions set custom_price = $2 where user_id = $1', [userId, sale]);
}
