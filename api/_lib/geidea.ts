// Geidea Checkout v2 (Saudi PGW). The browser only ever receives a session id;
// a payment counts only after the server re-reads the order from Geidea itself.
import { pool } from './db.js';
import { HttpError } from './http.js';
import { getEnv, requestRuntime } from './runtime.js';
import { getPlans, getAccountSummary, activateSubscription } from './account.js';
import { getPageDataByUserId, savePageData } from './page.js';
import { purgePublicPage } from './publicCache.js';
import { subscriptionCheckoutPolicy } from '../../shared/subscriptionCheckout.js';
import type { SessionUser } from './session.js';

export function geideaConfig() {
  const publicKey = getEnv('GEIDEA_PUBLIC_KEY'); const apiPassword = getEnv('GEIDEA_API_PASSWORD');
  if (!publicKey || !apiPassword) return null;
  return {
    publicKey, apiPassword,
    environment: getEnv('GEIDEA_ENVIRONMENT') === 'live' ? 'live' as const : 'test' as const,
    apiBase: getEnv('GEIDEA_API_BASE') || 'https://api.ksamerchant.geidea.net',
    hppBase: getEnv('GEIDEA_HPP_BASE') || 'https://www.ksamerchant.geidea.net',
    returnOrigin: getEnv('GEIDEA_RETURN_ORIGIN') || 'https://onwan.link',
    callbackOrigin: getEnv('GEIDEA_CALLBACK_ORIGIN') || 'https://onwan.link',
  };
}
export const geideaEnabled = () => geideaConfig() !== null;
function requireConfig() { const c = geideaConfig(); if (!c) throw new HttpError(503, 'الدفع الإلكتروني غير مفعّل حاليًا.', 'payment_not_configured'); return c; }

const amountText = (value: number) => value.toFixed(2);
async function hmacBase64(key: string, data: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
  let bin = ''; for (const b of sig) bin += String.fromCharCode(b); return btoa(bin);
}
function timestamp() { // "Y/m/d H:i:s" in UTC, as in Geidea's sample
  const d = new Date(); const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
const auth = (c: NonNullable<ReturnType<typeof geideaConfig>>) => 'Basic ' + btoa(`${c.publicKey}:${c.apiPassword}`);

async function annualTotal() {
  const total = subscriptionCheckoutPolicy(await getPlans()).total;
  if (total === null || total <= 0) throw new HttpError(409, 'لم يُحدد سعر الاشتراك بعد.');
  return total;
}

export async function startGeideaCheckout(_params: unknown, user: SessionUser) {
  const c = requireConfig();
  const amount = await annualTotal();
  const client = await pool.connect(); let order: any;
  try {
    await client.query('begin');
    const owner = (await client.query('select account_kind,email_verified_at,status,email from users where id=$1 for update', [user.id])).rows[0];
    if (!owner || owner.status !== 'active' || !owner.email_verified_at || owner.account_kind === 'nonprofit') throw new HttpError(403, 'أكمل حسابك وتأكيد بريدك قبل الدفع.');
    if ((await client.query("select 1 from subscriptions where user_id=$1 and status='active' and expires_at>now()", [user.id])).rowCount) throw new HttpError(409, 'اشتراكك فعّال بالفعل.');
    if ((await client.query('select 1 from partner_referrals where user_id=$1', [user.id])).rowCount) throw new HttpError(409, 'طلبك مرتبط بشريك؛ أكمل الدفع عبر مساره.');
    if ((await client.query("select 1 from geidea_orders where user_id=$1 and status in ('paid','publication_failed')", [user.id])).rowCount) throw new HttpError(409, 'تم استلام دفعتك ونعمل على نشر صفحتك. لا تدفع مرة ثانية.');
    const page = (await client.query('select status,draft_json,draft_saved_at from pages where user_id=$1 for update', [user.id])).rows[0];
    const data = page?.draft_json ?? await getPageDataByUserId(user.id, client);
    const name = (await client.query('select username from customer_names where user_id=$1', [user.id])).rows[0]?.username;
    if (!page || page.status === 'suspended' || !name || !data?.name?.trim() || data.editorForm) throw new HttpError(409, 'أكمل صفحتك واختر رابطها واحفظها قبل الدفع.');
    order = (await client.query(`insert into geidea_orders(user_id,environment,amount,page_json,draft_saved_at,username)
      values($1,$2,$3,$4::jsonb,$5,$6) returning *`, [user.id, c.environment, amount, JSON.stringify(data), page.draft_saved_at, name])).rows[0];
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }

  const ts = timestamp(); const amountStr = amountText(amount);
  const signature = await hmacBase64(c.apiPassword, `${c.publicKey}${amountStr}SAR${order.id}${ts}`);
  const response = await fetch(`${c.apiBase}/payment-intent/api/v2/direct/session`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: auth(c) },
    body: JSON.stringify({
      amount: Number(amountStr), currency: 'SAR', timestamp: ts, merchantReferenceId: order.id, signature,
      callbackUrl: `${c.callbackOrigin}/api/geidea/callback`,
      ...(c.returnOrigin.startsWith('https://') ? { returnUrl: `${c.returnOrigin}/payment/success?geidea=${order.id}` } : {}),
      language: 'ar', paymentOperation: 'Pay',
      customer: { email: user.email ?? undefined },
    }),
  });
  const body: any = await response.json().catch(() => null);
  const sessionId = body?.session?.id;
  if (!response.ok || body?.responseCode !== '000' || !sessionId) {
    console.error('[geidea] create session failed', response.status, body?.responseCode, body?.detailedResponseCode, body?.detailedResponseMessage);
    await pool.query("update geidea_orders set status='failed',updated_at=now() where id=$1", [order.id]);
    throw new HttpError(502, 'تعذر فتح صفحة الدفع الآن. لم يُخصم أي مبلغ؛ حاول مرة أخرى.');
  }
  await pool.query('update geidea_orders set session_id=$2,updated_at=now() where id=$1', [order.id, sessionId]);
  return { orderId: order.id, sessionId, scriptUrl: `${c.hppBase}/hpp/geideaCheckout.min.js` };
}

// Ask Geidea for the order and accept it only if it is ours, paid, and for the frozen amount.
async function verifyWithGeidea(geideaOrderId: string, ourId: string) {
  const c = requireConfig();
  if (!/^[0-9a-f-]{36}$/i.test(geideaOrderId)) return null;
  const response = await fetch(`${c.apiBase}/pgw/api/v1/direct/order/${geideaOrderId}`, { headers: { authorization: auth(c) } });
  const body: any = await response.json().catch(() => null);
  const o = body?.order;
  if (!response.ok || !o) return null;
  const order = (await pool.query('select * from geidea_orders where id=$1', [ourId])).rows[0];
  if (!order || String(o.merchantReferenceId).toLowerCase() !== order.id) return null;
  const paid = String(o.status).toLowerCase() === 'success' && String(o.detailedStatus ?? '').toLowerCase() === 'paid';
  const failed = ['failed', 'cancelled', 'expired'].includes(String(o.status).toLowerCase());
  if (paid && (amountText(Number(o.amount)) !== amountText(Number(order.amount)) || o.currency !== order.currency)) {
    console.error('[geidea] amount mismatch', ourId); return null;
  }
  return { paid, failed, isTest: Boolean(o.isTest), order };
}

export async function recordGeideaResult(ourId: string, geideaOrderId: string) {
  const result = await verifyWithGeidea(geideaOrderId, ourId);
  if (!result) return;
  if (result.paid) {
    await pool.query(`update geidea_orders set status='paid',geidea_order_id=$2,is_test=$3,paid_at=now(),updated_at=now()
      where id=$1 and paid_at is null`, [ourId, geideaOrderId, result.isTest]);
    await fulfillGeideaOrder(ourId);
  } else if (result.failed) {
    await pool.query("update geidea_orders set status='failed',geidea_order_id=coalesce(geidea_order_id,$2),updated_at=now() where id=$1 and paid_at is null", [ourId, geideaOrderId]);
  }
}

export async function fulfillGeideaOrder(id: string) {
  const client = await pool.connect(); let username: string | undefined;
  try {
    await client.query('begin');
    const ownerId = (await client.query('select user_id from geidea_orders where id=$1', [id])).rows[0]?.user_id;
    if (!ownerId) { await client.query('commit'); return; }
    const owner = (await client.query('select status,email_verified_at,account_kind from users where id=$1 for update', [ownerId])).rows[0];
    const order = (await client.query('select * from geidea_orders where id=$1 for update', [id])).rows[0];
    if (!order?.paid_at || order.fulfilled_at) { await client.query('commit'); return; }
    const page = (await client.query('select status,draft_json,draft_saved_at from pages where user_id=$1 for update', [ownerId])).rows[0];
    const name = (await client.query('select username from customer_names where user_id=$1', [ownerId])).rows[0]?.username;
    if (owner?.status !== 'active' || owner.account_kind === 'nonprofit' || !page || page.status === 'suspended' || name !== order.username) throw new HttpError(409, 'تحتاج الصفحة مراجعة قبل النشر.');
    await activateSubscription(ownerId, 'annual', `GEIDEA:${order.environment}:${order.geidea_order_id}`, client);
    await savePageData(ownerId, order.page_json, { client });
    const unchanged = String(page.draft_saved_at) === String(order.draft_saved_at);
    if (unchanged) await client.query('update pages set draft_json=null,draft_saved_at=null,draft_base_revision=null where user_id=$1', [ownerId]);
    else if (page.draft_json) await client.query('update pages set draft_json=$2::jsonb,draft_saved_at=$3,draft_base_revision=published_revision where user_id=$1', [ownerId, JSON.stringify(page.draft_json), page.draft_saved_at]);
    await client.query("update pages set status='published' where user_id=$1", [ownerId]);
    // Test-environment payments are not revenue.
    if (order.environment === 'live' && !order.is_test) {
      await client.query(`insert into payments(user_id,kind,amount,reference,label,recorded_by) values($1,'subscription',$2,$3,'اشتراك سنوي — Geidea','geidea')`,
        [ownerId, order.amount, `GEIDEA:${order.geidea_order_id}`]);
    }
    await client.query("update geidea_orders set status='published',fulfilled_at=now(),updated_at=now() where id=$1", [id]);
    username = (await getPageDataByUserId(ownerId, client))?.username;
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    await pool.query("update geidea_orders set status='publication_failed',updated_at=now() where id=$1 and paid_at is not null and fulfilled_at is null", [id]);
    throw error;
  } finally { client.release(); }
  if (username) await purgePublicPage(username).catch(() => undefined);
}

// Called by the result page after Geidea redirects back. Shape matches checkout.status.
export async function geideaCheckoutStatus(params: any, user: SessionUser) {
  requireConfig();
  const id = String(params.order ?? '');
  const find = () => pool.query('select * from geidea_orders where id::text=$1 and user_id=$2', [id, user.id]);
  let order = (await find()).rows[0];
  if (!order) throw new HttpError(404, 'لم نجد عملية الدفع.');
  if (!order.paid_at && order.status !== 'failed') {
    const geideaId = String(params.geideaOrderId ?? order.geidea_order_id ?? '');
    if (geideaId) await recordGeideaResult(order.id, geideaId).catch(error => console.error('[geidea] verify', error instanceof HttpError ? error.status : 'internal'));
  } else if (order.status === 'paid' || order.status === 'publication_failed') await fulfillGeideaOrder(order.id).catch(() => undefined);
  order = (await find()).rows[0];
  const state = order.status === 'published' ? 'published' : order.status === 'failed' ? 'failed'
    : order.paid_at ? 'publication_pending' : 'pending';
  return { state, demo: false, test: order.environment === 'test', username: state === 'published' ? order.username : null,
    ...(state === 'published' ? { account: await getAccountSummary(user.id) } : {}) };
}

export async function retryGeideaFulfillment() {
  const rows = await pool.query("select id from geidea_orders where status in ('paid','publication_failed') order by updated_at limit 10");
  for (const row of rows.rows) await fulfillGeideaOrder(row.id).catch(() => undefined);
}

// Webhook: never trust the body; it only tells us which order to re-check with Geidea.
export async function handleGeideaCallback(body: any) {
  const o = body?.order ?? body;
  const geideaId = String(o?.orderId ?? o?.id ?? ''); const ref = String(o?.merchantReferenceId ?? '').toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(ref) || !geideaId) return;
  const run = () => recordGeideaResult(ref, geideaId).catch(error => console.error('[geidea] callback', error instanceof HttpError ? error.status : 'internal'));
  const runtime = requestRuntime();
  if (runtime?.defer) runtime.defer(run); else await run();
}
