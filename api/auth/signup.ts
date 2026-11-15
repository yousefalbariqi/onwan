import { assertNotLocked, recordFailure, clearFailures } from '../_lib/loginGuard.js';
import { loadDraft } from '../_lib/pageDraft.js';
import { requireCreationDraft } from '../_lib/creationDraft.js';
import { serverTiming } from '../_lib/serverTiming.js';
import { assertHuman } from '../_lib/turnstile.js';
import { attachReferral } from '../_lib/partnerReferral.js';
import { getAccountSummary, normalizeEmail } from '../_lib/account.js';
import { EMAIL_HINT, PHONE_HINT, isValidEmailAddress, normalizeSaudiMobile } from '../../shared/accountRules.js';
import { createSessionToken } from '../_lib/auth.js';
import { pool } from '../_lib/db.js';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from '../_lib/http.js';
import { ensurePageForUser, getPageDataByUserId } from '../_lib/page.js';
import { hashPassword, validatePassword, verifyPassword } from '../_lib/password.js';
import { validateUsername, reserveUsername } from '../_lib/username.js';

// ACCT-01 / ACCT-02 / ACCT-03: name + mandatory phone + email + password.
// The account and its draft page are created immediately, with no prior
// approval; the page is not public until payment is confirmed.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  const timing = serverTiming(res);
  try {
    const body = await timing.measure('body', () => readJsonBody(req));
    await timing.measure('turnstile', () => assertHuman(req, body)); // REQ-020
    const creation = body.creationToken ? await requireCreationDraft({ headers: { authorization: `Bearer ${body.creationToken}` } }, { allowCompleted: true }) : null;
    const email = normalizeEmail(body.email);
    if (creation && (email !== creation.email || body.nonprofit === true)) throw new HttpError(400, 'استخدم البريد الموثق المرتبط بمسودتك.');
    if (creation && body.termsAccepted !== true && !(creation.terms_accepted_at && creation.terms_version === 'account-v1')) throw new HttpError(400, 'وافق على الشروط وسياسة الخصوصية أولًا.');
    // Note 07: a Saudi mobile, stored as 05XXXXXXXX.
    const phone = normalizeSaudiMobile(String(body.phone ?? ''));
    const password = String(body.password ?? '');

    if (!phone) {
      throw new HttpError(400, PHONE_HINT);
    }

    if (!isValidEmailAddress(email)) {
      throw new HttpError(400, EMAIL_HINT);
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      throw new HttpError(400, passwordError);
    }

    // Availability was previewed in the form. Validate syntax here, then
    // recheck availability once at reservation instead of doing it twice.
    const validation = timing.sync('username_validate', () => validateUsername(String(body.username ?? '')));
    if (!validation.valid) {
      throw new HttpError(409, validation.reason ?? 'الاسم غير صالح.', 'username_invalid');
    }

    const client = await timing.measure('db_connect', () => pool.connect());
    let userId: string;

    try {
      await timing.measure('tx_begin', () => client.query('begin'));

      let lockedCreation: any = null;
      if (creation) {
        lockedCreation = (await client.query('select * from creation_email_drafts where id=$1 and email=$2 and revoked_at is null for update', [creation.id, email])).rows[0];
        if (!lockedCreation) throw new HttpError(401, 'أعد التحقق من بريد المسودة.');
        if (lockedCreation.account_user_id) {
          // A lost response can be retried, but the scoped token alone must never
          // become a reusable login credential after account completion.
          await assertNotLocked('creation_complete', email);
          const owner = (await client.query('select password_hash from users where id=$1', [lockedCreation.account_user_id])).rows[0];
          if (!owner || !verifyPassword(password, owner.password_hash)) { await recordFailure('creation_complete', email); throw new HttpError(409, 'تم إنشاء الحساب. سجّل الدخول للمتابعة.', 'account_exists'); }
          await clearFailures('creation_complete', email);
          userId = lockedCreation.account_user_id;
          await client.query('commit');
          const pageData = (await loadDraft(userId))?.pageData ?? await getPageDataByUserId(userId);
          sendJson(res, 200, { token: createSessionToken(userId, email), pageData, account: await getAccountSummary(userId) });
          return;
        }
        if (!lockedCreation.page_json) throw new HttpError(400, 'احفظ التصميم قبل إكمال الحساب.');
      }
      const passwordHash = timing.sync('password_hash', () => hashPassword(password));
      const userResult = await timing.measure('user_insert', () => client.query<{ id: string }>(
        'insert into users (email, phone, password_hash) values ($1, $2, $3) returning id',
        [email, phone, passwordHash],
      ));

      userId = userResult.rows[0].id;
      if (body.nonprofit === true) await timing.measure('nonprofit_kind', () => client.query("update users set account_kind='nonprofit' where id=$1", [userId]));

      // Association signup only stores a suggestion; no availability check
      // or reservation here. The ordinary customer flow stays unchanged.
      if (body.nonprofit !== true) {
        await timing.measure('username_reserve', () => reserveUsername(client, userId, validation.normalized));
      }

      await timing.measure('page_ensure', () => ensurePageForUser(userId, client));
      // Note 22: the Arabic name the association typed becomes its page name.
      if (body.nonprofit === true) {
        await timing.measure('organization_name', () => client.query('update pages set display_name = $2, suggested_username = $3 where user_id = $1', [userId, String(body.organizationName ?? '').trim().slice(0, 160), validation.normalized]));
      }
      if (body.nonprofit !== true && String(body.organizationName ?? '').trim()) {
        await client.query('update pages set display_name = $2 where user_id = $1', [userId, String(body.organizationName).trim().slice(0, 80)]);
      }
      if (lockedCreation) {
        const draft = { ...lockedCreation.page_json, name: String(body.organizationName ?? lockedCreation.page_json.name).trim().slice(0, 80), username: validation.normalized };
        if (!draft.name) throw new HttpError(400, 'أدخل اسم الصفحة.');
        await client.query('update users set email_verified_at=now() where id=$1', [userId]);
        await client.query(`update pages set display_name=$2,draft_json=$3::jsonb,draft_saved_at=now(),draft_base_revision=published_revision where user_id=$1`, [userId, draft.name, JSON.stringify(draft)]);
        await client.query("update creation_email_drafts set account_user_id=$2,account_completed_at=now(),terms_accepted_at=coalesce(terms_accepted_at,now()),terms_version='account-v1' where id=$1", [creation!.id, userId]);
      }
      await timing.measure('referral', () => attachReferral(client, userId, body.partnerRef));
      await timing.measure('tx_commit', () => client.query('commit'));
    } catch (error: any) {
      await timing.measure('tx_rollback', () => client.query('rollback'));

      if (error instanceof HttpError) {
        throw error;
      }

      if (error?.code === '23505') {
        const constraint = String(error.constraint ?? '');

        if (constraint.includes('username')) {
          throw new HttpError(409, 'هذا الاسم حُجز للتو. اختر اسمًا آخر.', 'username_taken');
        }

        // Email or phone already registered.
        throw new HttpError(409, 'يوجد حساب مسجل بهذا البريد أو رقم الجوال. سجّل الدخول بدلًا من ذلك.', 'account_exists');
      }

      throw error;
    } finally {
      client.release();
    }

    // Owner decision: signup sends no automatic email. Email verification
    // stays available on request; creating an account does not verify it.

    const response = {
      token: createSessionToken(userId, email),
      pageData: creation ? (await loadDraft(userId))?.pageData : await timing.measure('page_load', () => getPageDataByUserId(userId)),
      account: await timing.measure('account_load', () => getAccountSummary(userId)),
    };
    timing.flush();
    sendJson(res, 200, response);
  } catch (error) {
    timing.flush();
    handleApiError(res, error);
  }
}
