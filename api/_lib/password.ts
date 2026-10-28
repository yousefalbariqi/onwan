import crypto from 'node:crypto';
import { PASSWORD_MIN, passwordProblem } from '../../shared/accountRules.js';

export const MIN_PASSWORD_LENGTH = PASSWORD_MIN;

const KEY_LENGTH = 64;

// Note 07: every new password (sign-up, reset, change) must be strong:
// 8+ characters with upper and lower case and a digit.
// Existing passwords keep working at sign-in.
export function validatePassword(password: string) {
  return passwordProblem(password);
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
