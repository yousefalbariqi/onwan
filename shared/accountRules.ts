// Note 07: one set of sign-up rules for the browser (live hints) and the
// server (the real check), so both always agree.

// A Saudi mobile: 05XXXXXXXX, 5XXXXXXXX, +9665XXXXXXXX or 009665XXXXXXXX.
// Returns the stored form 05XXXXXXXX, or null when it is not one.
export function normalizeSaudiMobile(value: string): string | null {
  const digits = String(value ?? '').replace(/[\s-]/g, '').replace(/^\+/, '00');
  const match = /^(?:00966|966|0)?(5\d{8})$/.exec(digits);
  return match ? `0${match[1]}` : null;
}

export const PHONE_HINT = 'أدخل رقم جوال سعودي صحيح يبدأ بـ 05 (مثل 0512345678).';

// Rejects «name@», «name.com», spaces, double dots and one-letter endings.
export function isValidEmailAddress(value: string) {
  const email = String(value ?? '').trim();
  if (email.length > 254 || /\s|\.\./.test(email)) return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/.test(email)
    && !email.startsWith('.') && !email.split('@')[0].endsWith('.');
}

export const EMAIL_HINT = 'يرجى إدخال بريد إلكتروني صحيح.';

export const PASSWORD_MIN = 8;
export const PASSWORD_HINT = 'استخدم 8 خانات على الأقل، تتضمن حرفًا كبيرًا وصغيرًا ورقمًا.';

// The problem with a new password, or null when it is acceptable. Owner
// decision: only these four rules — no checks for sequences, repeats or
// common words.
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return PASSWORD_HINT;
  if (password.length > 200) return 'كلمة المرور طويلة جدًا.';
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return PASSWORD_HINT;
  return null;
}

// Each rule on its own, for the live checklist under the field.
export function passwordChecks(password: string) {
  return [
    { label: '8 خانات على الأقل', ok: password.length >= PASSWORD_MIN },
    { label: 'حرف كبير (A–Z)', ok: /[A-Z]/.test(password) },
    { label: 'حرف صغير (a–z)', ok: /[a-z]/.test(password) },
    { label: 'رقم', ok: /\d/.test(password) },
  ];
}
