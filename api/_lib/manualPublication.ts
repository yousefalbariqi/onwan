import { purgePublicPage } from './publicCache.js';
import { pool } from './db.js';
import { HttpError } from './http.js';
import { pricePlan } from './account.js';
import { getReferralOffer } from './partnerReferral.js';
import { getPageDataByUserId, savePageData } from './page.js';

// A narrow exception for the official launch flow. No paid transaction,
// subscription activation, receipt, or referral conversion is invented.
export async function publishWithManualPayment(params: any, user: { id: string }) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const owner = (await client.query('select account_kind,email_verified_at,status from users where id=$1 for update', [user.id])).rows[0];
    if (!owner || owner.status !== 'active' || !owner.email_verified_at || owner.account_kind === 'nonprofit') throw new HttpError(403, 'أكمل حسابك وتأكيد بريدك قبل النشر.');
    if (await getReferralOffer(user.id)) throw new HttpError(409, 'أكمل الاشتراك عبر مسار الشريك.');
    const page = (await client.query('select status,draft_json from pages where user_id=$1 for update', [user.id])).rows[0];
    if (!page || page.status === 'suspended') throw new HttpError(409, 'هذه الصفحة غير متاحة للنشر. تواصل مع الإدارة.');
    const previous = (await client.query('select * from registration_carts where user_id=$1 and manual_published_at is not null order by created_at desc limit 1 for update', [user.id])).rows[0];
    if (previous) {
      if (previous.status === 'cancelled') throw new HttpError(409, 'طلب الاشتراك ملغى. تواصل مع الإدارة.');
      const data = await getPageDataByUserId(user.id, client);
      await client.query('commit');
      return { cartNumber: previous.cart_number, username: data?.username, total: Number(previous.total), alreadyPublished: true };
    }
    if ((await client.query("select 1 from subscriptions where user_id=$1 and status='active' and expires_at>now()", [user.id])).rowCount) throw new HttpError(409, 'اشتراكك فعّال بالفعل.');
    const pricing = await pricePlan('annual', '', user.id);
    if (!pricing || !Number.isFinite(pricing.finalPrice) || pricing.finalPrice <= 0) throw new HttpError(409, 'سعر الاشتراك غير متاح الآن.');
    if (Number(params.expectedTotal) !== pricing.finalPrice) throw new HttpError(409, 'تغير السعر. حدّث شاشة الاشتراك قبل النشر.', 'price_changed');
    const open = (await client.query("select * from registration_carts where user_id=$1 and status='pending_payment' for update", [user.id])).rows[0];
    if (open && (open.plan !== 'annual' || open.design_price !== null || Number(open.nfc_quantity)>0 || open.custom_domain || open.discount_code || Number(open.total)!==pricing.finalPrice)) throw new HttpError(409, 'راجع السلة السابقة قبل إنشاء طلب الاشتراك.');
    const data = page.draft_json ?? await getPageDataByUserId(user.id, client);
    if (!data || !String(data.name ?? '').trim() || data.editorForm) throw new HttpError(400, 'أكمل عناصر صفحتك واحفظها قبل النشر.');
    // Fix the public address without marking payment or subscription as active.
    await client.query(`insert into usernames(user_id,username) select user_id,username from username_reservations r where user_id=$1
      and not exists(select 1 from usernames u where u.user_id=r.user_id or u.username=r.username)`, [user.id]);
    if (!(await client.query('select 1 from usernames where user_id=$1', [user.id])).rowCount) throw new HttpError(409, 'الرابط لم يعد متاحًا. اختر رابطًا آخر قبل النشر.');
    await client.query('delete from username_reservations where user_id=$1', [user.id]);
    await savePageData(user.id, data, { client });
    await client.query("update pages set status='published',draft_json=null,draft_saved_at=null,draft_base_revision=null where user_id=$1", [user.id]);
    await client.query(`insert into subscriptions(user_id,plan,status) values($1,'annual','pending_payment')
      on conflict(user_id) do update set plan='annual',status='pending_payment',updated_at=now()`, [user.id]);
    let cart;
    if (open) cart = (await client.query('update registration_carts set manual_published_at=now() where id=$1 returning cart_number,total', [open.id])).rows[0];
    else cart = (await client.query(`insert into registration_carts(user_id,plan,plan_price,total,plan_list_price,general_discount,manual_published_at)
      values($1,'annual',$2,$2,$3,$4,now()) returning cart_number,total`, [user.id,pricing.finalPrice,pricing.listPrice,pricing.generalDiscount])).rows[0];
    const saved = await getPageDataByUserId(user.id, client);
    await client.query('commit');
    await purgePublicPage(saved?.username).catch(() => undefined);
    return { cartNumber: cart.cart_number, username: saved?.username, total: Number(cart.total) };
  } catch (error: any) { await client.query('rollback'); if (error?.code === '23505') throw new HttpError(409, 'تغير حجز الرابط أو طلب الاشتراك. حدّث الشاشة وحاول مجددًا.'); throw error; }
  finally { client.release(); }
}
