import crypto from 'crypto';
import { Resend } from 'resend';

function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

function getFromEmail(): string {
  return process.env.EMAIL_FROM || 'bio.sa <onboarding@resend.dev>';
}

export function generateOtp(): string {
  return crypto.randomInt(1000, 9999).toString();
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const resend = getResend();
  const from = getFromEmail();

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: 'رمز التحقق - bio.sa',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669;">bio.sa</h2>
        <p>رمز التحقق الخاص بك:</p>
        <div style="background: #f0fdf4; border: 2px solid #059669; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #059669;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">صالح لمدة 10 دقائق. لا تشاركه مع أحد.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
