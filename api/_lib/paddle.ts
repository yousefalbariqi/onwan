import { Environment, LogLevel, Paddle } from '@paddle/paddle-node-sdk';
import { getEnv } from './runtime.js';
import { HttpError } from './http.js';

export function paddleConfig() {
  if (getEnv('PADDLE_ENABLED') !== 'true' || getEnv('PADDLE_ENVIRONMENT') !== 'sandbox') {
    throw new HttpError(503, 'ربط Paddle التجريبي غير مفعّل على الخادم.', 'paddle_not_configured');
  }
  const key = getEnv('PADDLE_SANDBOX_API_KEY');
  const priceId = getEnv('PADDLE_PRICE_ID');
  const secret = getEnv('PADDLE_NOTIFICATION_WEBHOOK_SECRET');
  if (!key || !priceId || !/^pri_[a-z0-9]{26}$/.test(priceId) || !secret) {
    throw new HttpError(503, 'إعدادات تأكيد الدفع غير مكتملة. لم يتم بدء عملية دفع.', 'paddle_not_configured');
  }
  return { key, priceId, secret, environment: 'sandbox' as const };
}
export function paddleClient() {
  const config = paddleConfig();
  return new Paddle(config.key, { environment: Environment.sandbox, logLevel: LogLevel.error });
}
