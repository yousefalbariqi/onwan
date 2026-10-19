import { getEnv } from './runtime.js';
import crypto from 'node:crypto';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const STAFF_SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export type SessionKind = 'staff' | 'partner';

type SessionPayload = {
  userId: string;
  email: string;
  exp: number;
  // Staff and partner tokens are marked so they can never be used as a
  // beneficiary session (or the other way round).
  kind?: SessionKind;
};

function getSecret() {
  const secret = getEnv('SESSION_SECRET');

  if (!secret) {
    throw new Error('SESSION_SECRET is not configured');
  }

  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
}

export function createSessionToken(userId: string, email: string, kind?: SessionKind) {
  const payload: SessionPayload = {
    userId,
    email,
    exp: Date.now() + (kind === 'staff' ? STAFF_SESSION_TTL_MS : SESSION_TTL_MS),
    ...(kind ? { kind } : {}),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split('.');

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = Buffer.from(sign(encodedPayload));
  const actualSignature = Buffer.from(providedSignature);

  // timingSafeEqual throws on a length mismatch, so a malformed token must be
  // rejected before the comparison.
  if (
    actualSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;

  if (payload.exp < Date.now()) {
    return null;
  }

  return payload;
}

export function getBearerToken(req: any) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }

  return authorization.slice('Bearer '.length);
}
