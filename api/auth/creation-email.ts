import { requireCreationDraft } from '../_lib/creationDraft.js';
import crypto from 'node:crypto';
import { isValidEmailAddress } from '../../shared/accountRules.js';
import { normalizeEmail } from '../_lib/account.js';
import { createSessionToken } from '../_lib/auth.js';
import { pool } from '../_lib/db.js';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from '../_lib/http.js';
import { assertNotLocked, clearFailures, recordFailure } from '../_lib/loginGuard.js';
import { codeFailure, consumeCode, issueCode, OTP_RESEND_SECONDS, resendWaitSeconds } from '../_lib/otp.js';
import { assertHuman } from '../_lib/turnstile.js';

export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) return;
  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    if (!isValidEmailAddress(email)) throw new HttpError(400, 'أدخل بريدًا إلكترونيًا صحيحًا.');
    if (body.action === 'change-send' || body.action === 'change-verify') {
      const draft = await requireCreationDraft(req);
      if (body.action === 'change-send') {
        await assertHuman(req, body);
        await issueCode(email, 'creation_email_change', 'رمز تأكيد بريدك الجديد في عنوان:');
        sendJson(res, 200, { retryAfter: OTP_RESEND_SECONDS }); return;
      }
      if (!/^\d{4}$/.test(String(body.code ?? ''))) throw new HttpError(400, 'أدخل رمز التحقق من 4 أرقام.');
      await assertNotLocked('creation_change', email);
      if (!(await consumeCode(email, 'creation_email_change', String(body.code)))) {
        await recordFailure('creation_change', email); throw await codeFailure(email, 'creation_email_change');
      }
      await clearFailures('creation_change', email);
      const client = await pool.connect();
      try {
        await client.query('begin');
        const row = (await client.query('select * from creation_email_drafts where id=$1 and email=$2 and revoked_at is null and account_user_id is null for update', [draft.id, draft.email])).rows[0];
        if (!row) throw new HttpError(409, 'تغيرت هوية المسودة. أعد فتحها.');
        if ((await client.query('select id from users where email=$1', [email])).rowCount) throw new HttpError(409, 'البريد مرتبط بحساب موجود. استخدم بريدًا آخر أو سجّل الدخول.', 'account_exists');
        await client.query('update creation_email_drafts set email=$2,updated_at=now() where id=$1', [draft.id, email]);
        await client.query('commit');
        sendJson(res, 200, { id: draft.id, email, revision: Number(row.revision), token: createSessionToken(draft.id, email, 'creation') }); return;
      } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
    }
    if (body.action === 'send') {
      await assertHuman(req, body);
      // Fail before sending mail when the required migration has not been applied.
      await pool.query('select id from creation_email_drafts limit 0');
      const client = await pool.connect();
      let wait = 0;
      try {
        await client.query('begin');
        await client.query("select pg_advisory_xact_lock(hashtextextended('creation-code:' || $1, 0))", [email]);
        wait = await resendWaitSeconds(email, 'creation_draft', client);
        if (!wait) await issueCode(email, 'creation_draft', 'رمز حفظ بداية صفحتك في عنوان:', client);
        await client.query('commit');
      } catch (error) { await client.query('rollback'); throw error; }
      finally { client.release(); }
      // Identical response for new and existing customer emails. No account probing.
      sendJson(res, 200, { message: 'أرسلنا رمز تحقق إلى بريدك. أدخله لحفظ بداية صفحتك.', retryAfter: wait || OTP_RESEND_SECONDS });
      return;
    }
    if (body.action !== 'verify' || !/^\d{4}$/.test(String(body.code ?? ''))) throw new HttpError(400, 'أدخل رمز التحقق المكوّن من 4 أرقام.');
    const key = body.clientKey;
    if (key && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key)) throw new HttpError(400, 'معرف المسودة غير صالح.');
    await assertNotLocked('creation_email', email);
    if (!(await consumeCode(email, 'creation_draft', String(body.code)))) { await recordFailure('creation_email', email); throw await codeFailure(email, 'creation_draft'); }
    await clearFailures('creation_email', email);
    // Only reveal the existing-account route after mailbox ownership is proven.
    const existing = await pool.query('select id from users where email=$1 limit 1', [email]);
    if (existing.rowCount) { sendJson(res, 200, { existingAccount: true, email }); return; }
    let draft;
    if (!key) draft = (await pool.query('select id,email,revision,page_json from creation_email_drafts where email=$1 and revoked_at is null order by updated_at desc limit 1', [email])).rows[0];
    if (!draft) draft = (await pool.query(`insert into creation_email_drafts(email,client_key) values($1,$2)
      on conflict(email,client_key) do update set revoked_at=null returning id,email,revision,page_json`, [email, key || crypto.randomUUID()])).rows[0];
    sendJson(res, 200, { token: createSessionToken(draft.id, email, 'creation'), id: draft.id, email, revision: Number(draft.revision), pageData: draft.page_json });
  } catch (error) {
    if ((error as any)?.code === '42P01') handleApiError(res, new HttpError(503, 'خدمة حفظ البداية تحتاج تهيئة قاعدة البيانات قبل استخدامها.', 'creation_schema_required'));
    else handleApiError(res, error);
  }
}
