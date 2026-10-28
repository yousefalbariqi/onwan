import crypto from 'node:crypto';
import { pool } from './db.js';
import { generateOtp, sendOtpEmail } from './email.js';
import { HttpError } from './http.js';

export type OtpPurpose = 'verify_email' | 'reset_password' | 'account_change' | 'new_email' | 'partner_login';

const OTP_EXPIRY_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

export const OTP_RESEND_SECONDS = OTP_COOLDOWN_SECONDS;

// Seconds left before a new code may be sent (0 = now). Counted from when the
// last code was actually sent, so the editor can show a true countdown.
export async function resendWaitSeconds(email: string, purpose: OtpPurpose) {
  const recent = await pool.query<{ wait: number }>(
    `select ceil(extract(epoch from (created_at + make_interval(secs => $3) - now())))::int as wait
     from verification_codes
     where email = $1 and purpose = $2 and created_at > now() - make_interval(secs => $3)
     order by created_at desc limit 1`,
    [email, purpose, OTP_COOLDOWN_SECONDS],
  );
  return Math.max(0, recent.rows[0]?.wait ?? 0);
}

// REQ-018: at most 5 verification / recovery emails per address in 24 hours
// (every purpose together), on top of the 60-second gap between two codes.
const DAILY_CODES_PER_EMAIL = 5;

export async function issueCode(email: string, purpose: OtpPurpose, intro?: string) {
  const today = await pool.query<{ sent: number }>(
    "select count(*)::int as sent from verification_codes where email = $1 and created_at > now() - interval '24 hours'",
    [email],
  );
  if ((today.rows[0]?.sent ?? 0) >= DAILY_CODES_PER_EMAIL) {
    throw new HttpError(429, 'وصلت للحد اليومي من رموز التحقق لهذا البريد. حاول بعد 24 ساعة، أو تواصل مع الإدارة.', 'daily_code_limit');
  }

  const wait = await resendWaitSeconds(email, purpose);

  if (wait > 0) {
    // A code went out moments ago: not a failure, just not yet another one.
    throw new HttpError(429, `أرسلنا لك رمزًا قبل قليل. تحقق من بريدك، ويمكنك طلب رمز جديد بعد ${wait} ثانية.`, `resend_wait:${wait}`);
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Only the newest code stays usable.
  await pool.query(
    'update verification_codes set used = true where email = $1 and purpose = $2 and used = false',
    [email, purpose],
  );

  const inserted = await pool.query<{ id: string }>(
    `insert into verification_codes (email, code, purpose, expires_at)
     values ($1, $2, $3, $4)
     returning id`,
    [email, code, purpose, expiresAt],
  );

  try {
    await sendOtpEmail(email, code, intro);
  } catch (error) {
    // A code that never left must not start the resend cooldown.
    await pool.query('delete from verification_codes where id = $1', [inserted.rows[0].id]);
    console.error('OTP email failed:', error);
    throw new HttpError(502, 'تعذر إرسال الرمز إلى بريدك الآن. حاول بعد قليل، وإن تكرر تواصل مع الإدارة.');
  }
}

// One-time: a correct code is marked used; wrong guesses are counted and the
// code dies after OTP_MAX_ATTEMPTS.
export async function consumeCode(email: string, purpose: OtpPurpose, code: string) {
  const result = await pool.query<{ id: string; code: string; attempts: number }>(
    `select id, code, attempts from verification_codes
     where email = $1 and purpose = $2 and used = false and expires_at > now()
     order by created_at desc limit 1`,
    [email, purpose],
  );

  const row = result.rows[0];

  if (!row || row.attempts >= OTP_MAX_ATTEMPTS) {
    return false;
  }

  const provided = Buffer.from(code.trim());
  const expected = Buffer.from(row.code);
  const matches = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);

  if (!matches) {
    await pool.query('update verification_codes set attempts = attempts + 1 where id = $1 and used = false and attempts < $2', [row.id, OTP_MAX_ATTEMPTS]);
    return false;
  }

  // The conditional update claims the code atomically: concurrent requests
  // may read the same row, but only one can change unused to used.
  const claimed = await pool.query(
    'update verification_codes set used = true where id = $1 and used = false and attempts < $2 and expires_at > now() returning id',
    [row.id, OTP_MAX_ATTEMPTS],
  );
  return claimed.rows.length === 1;
}

// Note 71: why a code was refused, in plain words. A wrong code is a 400 —
// never a 401, which the app reads as «session over» and signs the user out.
export async function codeFailure(email: string, purpose: OtpPurpose) {
  const latest = await pool.query<{ expired: boolean; attempts: number; used: boolean }>(
    `select expires_at <= now() as expired, attempts, used from verification_codes
     where email = $1 and purpose = $2 order by created_at desc limit 1`,
    [email, purpose],
  );
  const row = latest.rows[0];
  let message = 'الرمز غير صحيح، حاول مرة أخرى.';
  if (!row || row.used) message = 'لا يوجد رمز صالح. اطلب رمزًا جديدًا.';
  else if (row.expired) message = 'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.';
  else if (row.attempts >= OTP_MAX_ATTEMPTS) message = 'تجاوزت عدد المحاولات المسموح. اطلب رمزًا جديدًا.';
  return new HttpError(400, message, 'code_rejected');
}
