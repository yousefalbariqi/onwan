import crypto from 'crypto';
import { pool } from './db';
import { generateOtp, sendOtpEmail } from './email';
import { HttpError } from './http';

export type OtpPurpose = 'verify_email' | 'reset_password' | 'account_change' | 'new_email';

const OTP_EXPIRY_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

export async function issueCode(email: string, purpose: OtpPurpose, intro?: string) {
  const recentCode = await pool.query(
    `select 1 from verification_codes
     where email = $1 and purpose = $2 and created_at > now() - make_interval(secs => $3)
     limit 1`,
    [email, purpose, OTP_COOLDOWN_SECONDS],
  );

  if (recentCode.rowCount) {
    throw new HttpError(429, 'يرجى الانتظار دقيقة قبل طلب رمز جديد.');
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Only the newest code stays usable.
  await pool.query(
    'update verification_codes set used = true where email = $1 and purpose = $2 and used = false',
    [email, purpose],
  );

  await pool.query(
    `insert into verification_codes (email, code, purpose, expires_at)
     values ($1, $2, $3, $4)`,
    [email, code, purpose, expiresAt],
  );

  await sendOtpEmail(email, code, intro);
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
    await pool.query('update verification_codes set attempts = attempts + 1 where id = $1', [row.id]);
    return false;
  }

  await pool.query('update verification_codes set used = true where id = $1', [row.id]);
  return true;
}
