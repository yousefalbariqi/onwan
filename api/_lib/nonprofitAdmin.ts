import type { Handler, Staff } from './admin.js';
import { audit } from './admin.js';
import { pool } from './db.js';
import { HttpError } from './http.js';
import { notifyNonprofit } from './nonprofit.js';
import { getPageDataByUserId } from './page.js';
import { getUsernameAvailability, validateUsername } from './username.js';
import { purgePublicPage } from './publicCache.js';
import type { PoolClient } from 'pg';
import { walletConfigured } from './wallet/pass.js';

export const NONPROFIT_STAGES = ['pending', 'contacted', 'agreed', 'quoted', 'paid', 'active', 'cancelled'];
function text(value: unknown, max = 8000) {
  const result = String(value ?? '').trim();
  if (result.length > max) throw new HttpError(400, 'النص أطول من الحد المسموح.');
  return result;
}
function amount(value: unknown) {
  if (typeof value !== 'number' && typeof value !== 'string') throw new HttpError(400, 'أدخل المبلغ بالريال.');
  const raw = String(value).trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw) || Number(raw) > 1000000) throw new HttpError(400, 'أدخل مبلغًا صحيحًا بالريال، بمنزلتين عشريتين كحد أقصى.');
  return Math.round(Number(raw) * 100) / 100;
}
export function nonprofitQuote(input: any) {
  const months = Number(input?.months);
  if (!Number.isInteger(months) || months < 1 || months > 120) throw new HttpError(400, 'مدة الاستضافة من شهر إلى 120 شهرًا.');
  const includes = text(input?.includes, 4000);
  if (!includes) throw new HttpError(400, 'اكتب الخدمات المشمولة في العرض.');
  return { amount: amount(input?.amount), currency: 'SAR', months, includes, notes: text(input?.notes, 4000) };
}
async function event(client: PoolClient, row: any, staff: Staff, action: string, details: Record<string, unknown> = {}) {
  await client.query('insert into nonprofit_request_events(request_id,staff_id,staff_name,action,details) values($1,$2,$3,$4,$5::jsonb)', [row.id, staff.id, staff.name, action, JSON.stringify(details)]);
  await client.query(`insert into audit_log(staff_id,staff_name,action,target_type,target_id,target_label,details)
    values($1,$2,$3,'nonprofit',$4,$5,$6::jsonb)`, [staff.id, staff.name, `nonprofits.${action}`, row.id, row.organization_name, JSON.stringify(details)]);
}
const joined = `from nonprofit_quote_requests r join users u on u.id=r.user_id and u.account_kind='nonprofit'
  join pages p on p.user_id=r.user_id left join staff s on s.id=r.assigned_staff_id`;

async function list(params: any) {
  const q = text(params.q, 160);
  const status = String(params.status ?? 'all');
  if (status !== 'all' && !NONPROFIT_STAGES.includes(status)) throw new HttpError(400, 'حالة الطلب غير صحيحة.');
  const page = Math.max(1, Math.min(10000, Math.trunc(Number(params.page) || 1)));
  const values = [`%${q}%`, status];
  const where = `where ($1='%%' or r.organization_name ilike $1 or r.phone ilike $1 or r.contact_name ilike $1 or r.request_number::text ilike $1)
    and ($2='all' or r.status=$2)`;
  const [rows, count, stats] = await Promise.all([
    pool.query(`select r.id,r.request_number,r.user_id,r.organization_name,r.contact_name,r.phone,r.status,r.email_status,r.created_at,r.updated_at,r.quote_json,r.sent_quote_json,p.status as page_status,s.name as assigned_staff_name ${joined} ${where} order by r.updated_at desc,r.id limit 25 offset $3`, [...values, (page - 1) * 25]),
    pool.query(`select count(*)::int as total ${joined} ${where}`, values),
    pool.query(`select r.status,count(*)::int as count ${joined} group by r.status`),
  ]);
  return { requests: rows.rows, total: count.rows[0]?.total ?? 0, stats: stats.rows, page, pageSize: 25 };
}
async function get(params: any) {
  const result = await pool.query(`select r.*,p.status as page_status,p.suggested_username,p.suspension_message,
    u.email_verified_at,u.status as account_status,s.name as assigned_staff_name,
    un.username as fixed_username,h.starts_at as hosting_starts_at,h.expires_at as hosting_expires_at
    ${joined} left join usernames un on un.user_id=r.user_id left join nonprofit_hosting h on h.user_id=r.user_id where r.id=$1`, [params.id]);
  const row = result.rows[0];
  if (!row) throw new HttpError(404, 'طلب الجمعية غير موجود.');
  const [events, pageData, payment] = await Promise.all([
    pool.query(`select staff_name,action,details,created_at from (
      select staff_name,action,details,created_at from nonprofit_request_events where request_id=$1
      union all
      select staff_name,'content' as action,details,created_at from audit_log where target_id=$2 and action='content.save'
    ) history order by created_at desc limit 200`, [row.id, row.user_id]),
    getPageDataByUserId(row.user_id),
    row.payment_id ? pool.query('select amount,reference,recorded_by,created_at from payments where id=$1', [row.payment_id]) : Promise.resolve({ rows: [] }),
  ]);
  return { request: row, events: events.rows, pageData, payment: payment.rows[0] ?? null };
}

// Every business mutation locks its request, checks the version and writes
// its audit trail in the same transaction. Retries cannot duplicate payment.
export async function nonprofitMutation(params: any, staff: Staff, action: string) {
  const client = await pool.connect();
  let username: string | undefined;
  try {
    await client.query('begin');
    const result = await client.query(`select r.*,u.status as account_status,u.email_verified_at,p.status as page_status,p.suggested_username
      from nonprofit_quote_requests r join users u on u.id=r.user_id and u.account_kind='nonprofit'
      join pages p on p.user_id=r.user_id where r.id=$1 for update of r,u,p`, [params.id]);
    const row = result.rows[0];
    if (!row) throw new HttpError(404, 'طلب الجمعية غير موجود.');
    if (Number(params.version) !== row.version) throw new HttpError(409, 'تغير الطلب بواسطة موظف آخر. حدّث الملف قبل المتابعة.');
    let details: Record<string, unknown> = {};
    if (action === 'update') {
      const stage = String(params.status ?? row.status);
      if (stage !== row.status && !((['pending', 'agreed'].includes(row.status) && stage === 'contacted') || (['pending', 'contacted', 'agreed', 'quoted'].includes(row.status) && stage === 'cancelled'))) {
        throw new HttpError(409, 'انتقال الحالة غير متاح. استخدم إجراءات العرض والتحويل والتفعيل.');
      }
      const notes = text(params.adminNotes);
      if (stage === 'cancelled' && !notes) throw new HttpError(400, 'اكتب سبب إلغاء الطلب في الملاحظات.');
      await client.query('update nonprofit_quote_requests set status=$2,admin_notes=$3,assigned_staff_id=coalesce(assigned_staff_id,$4) where id=$1', [row.id, stage, notes, staff.id]);
      details = { from: row.status, to: stage, notes };
    } else if (action === 'assign') {
      await client.query('update nonprofit_quote_requests set assigned_staff_id=$2 where id=$1', [row.id, staff.id]);
    } else if (action === 'quote') {
      if (!['pending', 'contacted', 'agreed', 'quoted'].includes(row.status)) throw new HttpError(409, 'لا يمكن تعديل عرض طلب مدفوع أو مفعّل أو ملغى.');
      const quote = nonprofitQuote(params.quote);
      await client.query('update nonprofit_quote_requests set quote_json=$2::jsonb where id=$1', [row.id, JSON.stringify(quote)]);
      details = { quote };
    } else if (action === 'sent') {
      if (!row.quote_json || !['pending', 'contacted', 'agreed', 'quoted'].includes(row.status)) throw new HttpError(409, 'احفظ عرض السعر أولًا.');
      await client.query("update nonprofit_quote_requests set sent_quote_json=quote_json,quote_sent_at=now(),status='quoted' where id=$1", [row.id]);
      details = { quote: row.quote_json, manualDelivery: true };
    } else if (action === 'payment') {
      if (row.payment_id || row.status !== 'quoted' || !row.sent_quote_json) throw new HttpError(409, 'التحويل مسجل أو لم يُسجل إرسال العرض بعد.');
      const paid = amount(params.amount);
      if (paid !== Number(row.sent_quote_json.amount)) throw new HttpError(400, 'المبلغ المحصّل يجب أن يطابق العرض المرسل. عدّل العرض وأعد تسجيل إرساله عند الاتفاق على مبلغ مختلف.');
      const reference = text(params.reference, 500);
      if (!reference) throw new HttpError(400, 'أدخل مرجع التحويل أو تفاصيل السداد.');
      const date = String(params.receivedAt ?? '');
      const receivedAt = new Date(`${date}T12:00:00+03:00`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(receivedAt.getTime()) || receivedAt.toISOString().slice(0, 10) !== date || receivedAt.getTime() > Date.now() + 24 * 60 * 60 * 1000 || receivedAt.getFullYear() < 2000) throw new HttpError(400, 'أدخل تاريخ التحويل الفعلي.');
      const payment = await client.query(`insert into payments(user_id,kind,amount,reference,label,recorded_by)
        values($1,'subscription',$2,$3,$4,$5) returning id`, [row.user_id, paid, reference, `استضافة جمعية — ${row.organization_name}`, staff.name]);
      await client.query("update nonprofit_quote_requests set payment_id=$2,paid_at=$3,status='paid' where id=$1", [row.id, payment.rows[0].id, receivedAt.toISOString()]);
      details = { amount: paid, reference, receivedAt: receivedAt.toISOString(), quote: row.sent_quote_json };
    } else if (action === 'activate') {
      if (row.status !== 'paid' || !row.payment_id || row.activated_at) throw new HttpError(409, 'يلزم تأكيد التحويل أولًا، ولا يكرر التفعيل.');
      if (row.account_status !== 'active' || row.page_status === 'suspended') throw new HttpError(409, 'الحساب محظور أو الصفحة موقوفة. عالج الإيقاف صراحة قبل التفعيل.');
      if (!row.email_verified_at) throw new HttpError(409, 'يجب تأكيد بريد الجمعية قبل التفعيل.');
      const validation = validateUsername(String(params.username ?? row.suggested_username ?? ''));
      if (!validation.valid) throw new HttpError(400, validation.reason || 'الرابط غير صالح.');
      username = validation.normalized;
      // Serialize writes to all name sources, including ordinary reservations.
      // This protects the cross-table check, not just usernames' unique index.
      await client.query('lock table usernames,username_reservations,reserved_usernames,username_redirects,partner_orders in share row exclusive mode');
      const fixed = await client.query('select username from usernames where user_id=$1', [row.user_id]);
      if (fixed.rows[0] && fixed.rows[0].username !== username) throw new HttpError(409, 'للجمعية رابط مثبت مختلف. تغيير الرابط يتم من الإجراء المخوّل لذلك.');
      if (!fixed.rows[0]) {
        const available = await getUsernameAvailability(username, { ignoreUserId: row.user_id }, client);
        if (!available.available) throw new HttpError(409, available.reason || 'الرابط غير متاح.');
        await client.query('delete from username_reservations where user_id=$1 or (username=$2 and expires_at<=now())', [row.user_id, username]);
        await client.query('insert into usernames(user_id,username) values($1,$2)', [row.user_id, username]);
      }
      const quote = nonprofitQuote(row.sent_quote_json);
      await client.query('update users set nonprofit_activated_at=coalesce(nonprofit_activated_at,now()) where id=$1', [row.user_id]);
      await client.query(`insert into nonprofit_hosting(user_id,request_id,starts_at,expires_at,months)
        values($1,$2,now(),now()+make_interval(months=>$3),$3)`, [row.user_id, row.id, quote.months]);
      await client.query("update pages set status='published',suggested_username=$2 where user_id=$1", [row.user_id, username]);
      await client.query("update nonprofit_quote_requests set status='active',activated_at=now() where id=$1", [row.id]);
      details = { username, months: quote.months, amount: quote.amount };
    } else if (action === 'suspend' || action === 'reactivate') {
      if (!row.activated_at) throw new HttpError(409, 'لم يتم تفعيل صفحة هذه الجمعية بعد.');
      const required = action === 'suspend' ? 'published' : 'suspended';
      if (row.page_status !== required || row.account_status !== 'active') throw new HttpError(409, 'حالة الصفحة أو الحساب لا تسمح بهذا الإجراء.');
      if (action === 'suspend') {
        const reason = text(params.reason, 2000), message = text(params.message, 1000);
        if (!reason || !message) throw new HttpError(400, 'اكتب سبب الإيقاف والرسالة التي تظهر للزائر.');
        await client.query("update pages set status='suspended',suspension_reason=$2,suspension_message=$3,suspended_at=now() where user_id=$1", [row.user_id, reason, message]);
        details = { reason, message };
      } else {
        await client.query("update pages set status='published',suspension_reason=null,suspension_message=null,suspended_at=null where user_id=$1", [row.user_id]);
      }
      username = (await client.query('select username from usernames where user_id=$1', [row.user_id])).rows[0]?.username;
    } else {
      throw new HttpError(400, 'الإجراء غير معروف.');
    }
    await client.query('update nonprofit_quote_requests set version=version+1,updated_at=now() where id=$1', [row.id]);
    await event(client, row, staff, action, details);
    await client.query('commit');
  } catch (error: any) {
    await client.query('rollback');
    if (error?.code === '23505') throw new HttpError(409, 'تعارض في الرابط أو التحصيل. حدّث الطلب وأعد التحقق.');
    throw error;
  } finally { client.release(); }
  if (username) await purgePublicPage(username).catch(() => undefined);
  return { saved: true };
}

const mutations = Object.fromEntries(['update','assign','quote','sent','payment','activate','suspend','reactivate'].map(action => [
  `nonprofits.${action}`, { access: 'staff', run: (params: any, staff: Staff) => nonprofitMutation(params, staff, action) } as Handler,
]));
export const nonprofitAdminHandlers: Record<string, Handler> = {
  ...mutations,
  'nonprofits.list': { access: 'staff', run: list },
  'nonprofits.get': { access: 'staff', run: get },
  'nonprofits.wallet': { access: 'staff', run: async (params) => {
    if (!walletConfigured()) throw new HttpError(503, 'بطاقة Apple Wallet غير مهيأة بعد.');
    const result = await pool.query(`select un.username from nonprofit_quote_requests r
      join users u on u.id=r.user_id and u.account_kind='nonprofit' and u.status='active'
      join pages p on p.user_id=r.user_id and p.status='published'
      join usernames un on un.user_id=r.user_id where r.id=$1`, [params.id]);
    if (!result.rows[0]) throw new HttpError(409, 'بطاقة الجمعية متاحة بعد تفعيل صفحتها.');
    return { url: `/api/wallet-pass?username=${encodeURIComponent(result.rows[0].username)}` };
  } },
  'nonprofits.retryEmail': { access: 'staff', run: async (params, staff) => {
    const row = await pool.query("update nonprofit_quote_requests r set email_attempts=0,email_status='pending' from users u where r.id=$1 and u.id=r.user_id and u.account_kind='nonprofit' and r.email_status='failed' returning r.id", [params.id]);
    if (!row.rows[0]) throw new HttpError(409, 'لا يوجد إشعار فاشل لإعادة إرساله.');
    await notifyNonprofit(params.id);
    await audit(staff, 'nonprofits.retryEmail', { type: 'nonprofit', id: params.id, label: 'إعادة إشعار الإدارة' });
    return { saved: true };
  } },
};
