import { pool } from './db.js';
import { HttpError } from './http.js';
import { getPageDataByUserId } from './page.js';
import { getEnv } from './runtime.js';
import { sendNoticeEmail } from './email.js';

export async function requireNonprofit(userId: string) {
  const result = await pool.query("select id from users where id=$1 and to_jsonb(users)->>'account_kind'='nonprofit'", [userId]);
  if (!result.rows[0]) throw new HttpError(403, 'هذه البوابة مخصصة لحسابات الجمعيات الخيرية.', 'nonprofit_only');
}
export async function nonprofitStatus(userId: string) {
  await requireNonprofit(userId);
  const result = await pool.query('select id, request_number, organization_name, contact_name, phone, email, notes, status, email_status, created_at from nonprofit_quote_requests where user_id=$1', [userId]);
  return { request: result.rows[0] ?? null };
}
function field(value: unknown, label: string, max: number) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw new HttpError(400, `تحقق من ${label}.`);
  return text;
}
export async function submitNonprofit(userId: string, input: any) {
  await requireNonprofit(userId);
  const client = await pool.connect();
  let row: any;
  try {
    await client.query('begin');
    await client.query('select id from users where id=$1 for update', [userId]);
    const existing = await client.query('select * from nonprofit_quote_requests where user_id=$1', [userId]);
    row = existing.rows[0];
    if (!row) {
      const organization = field(input.organizationName, 'اسم الجمعية', 160);
      const contact = field(input.contactName, 'اسم مسؤول التواصل', 160);
      // Contact details belong to this request; notifications go only to administration.
      // Note 19: the quote request no longer waits for a confirmed email; only
      // publishing does (activateSubscription).
      const account = await client.query('select email, phone from users where id=$1', [userId]);
      const phone = field(input.phone ?? account.rows[0].phone, 'هاتف التواصل', 30);
      const email = field(input.email ?? account.rows[0].email, 'بريد التواصل', 254);
      if (!/^[+\d\s()-]{7,30}$/.test(phone) || phone.replace(/\D/g, '').length < 7) throw new HttpError(400, 'تحقق من هاتف التواصل.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'تحقق من بريد التواصل.');
      const domain = String(input.customDomain ?? '').trim().toLowerCase();
      if (domain && (domain.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain))) throw new HttpError(400, 'أدخل النطاق فقط، مثل links.example.org، دون https أو مسار.');
      const notes = String(input.notes ?? '').trim();
      if (notes.length > 4000) throw new HttpError(400, 'الملاحظات أطول من الحد المسموح.');
      // Preserve the domain request in admin details and email without provisioning it.
      const requestNotes = [domain ? `طلب ربط نطاق الجمعية الخاص: ${domain} (للمراجعة ضمن عرض السعر؛ لم يتم الربط أو الحجز)` : '', notes].filter(Boolean).join('\n\n');
      await client.query('select id from pages where user_id=$1 for update', [userId]);
      const page = await getPageDataByUserId(userId);
      // Explicit editor save validates the design; autosaved drafts are not the submitted version.
      const snapshot = page;
      if (!snapshot || !snapshot.name?.trim()) throw new HttpError(400, 'أضف اسم الجمعية في التصميم واحفظه أولًا.');
      const result = await client.query(`insert into nonprofit_quote_requests(user_id,organization_name,contact_name,phone,email,notes,page_json)
        values($1,$2,$3,$4,$5,$6,$7::jsonb) returning *`, [userId,organization,contact,phone,email,requestNotes,JSON.stringify(snapshot)]);
      row = result.rows[0];
    }
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
  // Durable request first; notification failure never loses the association's request.
  try { await notifyNonprofit(row.id); } catch (error) { console.error('[nonprofit-notification] request saved; delivery deferred', error); }
  return nonprofitStatus(userId);
}
export async function notifyNonprofit(id: string) {
  const claimed = await pool.query(`update nonprofit_quote_requests set email_status='sending', email_attempts=email_attempts+1, email_attempted_at=now()
    where id=$1 and (email_status in ('pending','failed') or (email_status='sending' and email_attempted_at < now()-interval '10 minutes'))
    and email_attempts < 5 returning *`, [id]);
  const row = claimed.rows[0];
  if (!row) return;
  const to = getEnv('ADMIN_EMAIL');
  const sent = Boolean(to) && await sendNoticeEmail(to!, `طلب عرض سعر جمعية #${row.request_number}`, [
    `الجمعية: ${row.organization_name}`, `مسؤول التواصل: ${row.contact_name}`, `الهاتف: ${row.phone}`, `البريد: ${row.email}`,
    `الملاحظات: ${row.notes || 'لا توجد'}`, `الطلب محفوظ للمراجعة في تبويب الجمعيات: https://${getEnv('ROOT_DOMAIN') || 'onwan.link'}/admin?section=nonprofits`,
    'إرسال عرض السعر وتأكيد التحويل والتفعيل يتم يدويًا؛ لم يتم نشر الصفحة.',
  ]);
  await pool.query('update nonprofit_quote_requests set email_status=$2 where id=$1', [id,sent?'sent':'failed']);
}
export async function retryNonprofitNotifications() {
  const rows = await pool.query("select id from nonprofit_quote_requests where email_status <> 'sent' and email_attempts < 5 order by created_at limit 10");
  for (const row of rows.rows) await notifyNonprofit(row.id);
}
