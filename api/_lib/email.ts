import { getEnv } from './runtime.js';
import crypto from 'node:crypto';
import { Resend } from 'resend';

function getResend(): Resend {
  return new Resend(getEnv('RESEND_API_KEY'));
}

function getFromEmail(): string {
  return getEnv('EMAIL_FROM') || 'عنوان <onboarding@resend.dev>';
}

export function generateOtp(): string {
  // 4 digits (owner decision, 19 Oct 2026); OTP_MAX_ATTEMPTS in otp.ts keeps guessing out of reach.
  return crypto.randomInt(1000, 10000).toString();
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendOtpEmail(to: string, code: string, intro = 'رمز التحقق الخاص بك:'): Promise<void> {
  const resend = getResend();
  const from = getFromEmail();

  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: 'رمز التحقق - عنوان',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669;">عنوان</h2>
        <p>${escapeHtml(intro)}</p>
        <div style="background: #f0fdf4; border: 2px solid #059669; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #059669;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">صالح لمدة 10 دقائق. لا تشاركه مع أحد.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

// A plain notice to a beneficiary (e.g. MOD-04: why content was rejected).
// Best-effort, like the admin copy below.
export async function sendNoticeEmail(to: string, subject: string, lines: string[]): Promise<boolean> {
  try {
    const { error } = await getResend().emails.send({
      from: getFromEmail(),
      to: [to],
      subject,
      html: `<div dir="rtl" style="font-family: Arial, sans-serif;">${lines
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('')}</div>`,
    });

    if (error) {
      console.error('Failed to send notice email:', error.message);
    }

    return !error;
  } catch (error) {
    console.error('Failed to send notice email:', error);
    return false;
  }
}

// Copy of reports/requests to the administration mailbox (PUB-03, REQ-01).
// The record is already saved in the database, so a missing mailbox or a
// failed send must not fail the visitor's request.
export async function sendAdminEmail(subject: string, lines: string[]): Promise<void> {
  const to = getEnv('ADMIN_EMAIL');

  if (!to) {
    console.warn('ADMIN_EMAIL is not configured; admin notification skipped.');
    return;
  }

  try {
    const { error } = await getResend().emails.send({
      from: getFromEmail(),
      to: [to],
      subject,
      html: `<div dir="rtl" style="font-family: Arial, sans-serif;">${lines
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('')}</div>`,
    });

    if (error) {
      console.error('Failed to send admin email:', error.message);
    }
  } catch (error) {
    console.error('Failed to send admin email:', error);
  }
}
