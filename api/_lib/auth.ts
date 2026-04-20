import crypto from 'crypto';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

type SessionPayload = {
  userId: string;
  email: string;
  exp: number;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;

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

export function createSessionToken(userId: string, email: string) {
  const payload: SessionPayload = {
    userId,
    email,
    exp: Date.now() + SESSION_TTL_MS,
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

  const expectedSignature = sign(encodedPayload);

  if (!crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) {
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
