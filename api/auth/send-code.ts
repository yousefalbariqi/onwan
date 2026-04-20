import { pool } from '../_lib/db';
import { generateOtp, sendOtpEmail } from '../_lib/email';
import { allowMethods, handleApiError, readJsonBody, sendJson } from '../_lib/http';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

const OTP_EXPIRY_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 60;

export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(String(body.email ?? ''));
    const phone = normalizePhone(String(body.phone ?? ''));
    const username = body.username ? String(body.username).trim() : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendJson(res, 400, { error: 'البريد الإلكتروني غير صالح.' });
      return;
    }

    if (!/^[0-9]{8,20}$/.test(phone)) {
      sendJson(res, 400, { error: 'رقم الجوال مطلوب وغير صالح.' });
      return;
    }

    // Rate limit: check most recent code for this email
    const recentCode = await pool.query(
      `SELECT created_at FROM verification_codes
       WHERE email = $1 AND created_at > NOW() - INTERVAL '${OTP_COOLDOWN_SECONDS} seconds'
       LIMIT 1`,
      [email],
    );

    if (recentCode.rowCount) {
      sendJson(res, 429, { error: 'يرجى الانتظار قبل طلب رمز جديد.' });
      return;
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await pool.query(
      `INSERT INTO verification_codes (email, phone, code, username, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, phone || null, code, username || null, expiresAt],
    );

    await sendOtpEmail(email, code);

    sendJson(res, 200, { message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني.' });
  } catch (error) {
    handleApiError(res, error);
  }
}
