import crypto from 'node:crypto';

export const MIN_PASSWORD_LENGTH = 8;

const KEY_LENGTH = 64;

export function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `لزيادة أمان حسابك، اختر كلمة مرور من ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`;
  }

  if (password.length > 200) {
    return 'كلمة المرور طويلة جدًا.';
  }

  return null;
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH);

  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) {
    return false;
  }

  const [scheme, encodedSalt, encodedHash] = stored.split('$');

  if (scheme !== 'scrypt' || !encodedSalt || !encodedHash) {
    return false;
  }

  const expected = Buffer.from(encodedHash, 'base64url');
  const actual = crypto.scryptSync(password, Buffer.from(encodedSalt, 'base64url'), expected.length);

  return crypto.timingSafeEqual(actual, expected);
}
