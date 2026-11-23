import { initializePaddle, type Paddle, type PaddleEventData, type PricePreviewResponse } from '@paddle/paddle-js';

type Environment = Record<string, string | boolean | undefined>;
export const paddleSandboxRequested = (env: Environment) => env.VITE_PADDLE_SANDBOX_ENABLED === 'true';

export function sandboxConfig(env: Environment) {
  if (env.VITE_PADDLE_ENVIRONMENT !== 'sandbox') throw new Error('اضبط بيئة Paddle على sandbox لتشغيل الاختبار.');
  const token = String(env.VITE_PADDLE_CLIENT_TOKEN || '');
  const priceId = String(env.VITE_PADDLE_PRICE_ID || '');
  if (!/^test_[a-zA-Z0-9]+$/.test(token)) throw new Error('رمز واجهة Paddle التجريبي غير مضبوط.');
  if (!/^pri_[a-z0-9]{26}$/.test(priceId)) throw new Error('معرّف السعر التجريبي غير مضبوط.');
  return { token, priceId, environment: 'sandbox' as const };
}

export function sandboxPrice(response: PricePreviewResponse, priceId: string) {
  const items = response.data.details.lineItems;
  const item = items[0];
  if (items.length !== 1 || item?.price.id !== priceId || item.quantity !== 1 || item.price.status !== 'active'
    || item.price.billingCycle?.interval !== 'year' || item.price.billingCycle.frequency !== 1 || item.price.trialPeriod) {
    throw new Error('اختر سعر اشتراك سنوي فعّال، بدون فترة مجانية، لهذه التجربة.');
  }
  if (!item.formattedTotals.total) throw new Error('لم يصل سعر صالح من Paddle. حاول مجددًا.');
  return { total: item.formattedTotals.total, tax: item.formattedTotals.tax, currency: response.data.currencyCode,
    address: response.data.address?.countryCode ? { countryCode: response.data.address.countryCode,
      ...(response.data.address.postalCode ? { postalCode: response.data.address.postalCode } : {}) } : undefined };
}

const listeners = new Set<(event: PaddleEventData) => void>();
let instance: Promise<Paddle> | undefined;
let configuredToken: string | undefined;
export function subscribeToSandbox(listener: (event: PaddleEventData) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function loadSandbox(config: ReturnType<typeof sandboxConfig>): Promise<Paddle> {
  if (configuredToken && configuredToken !== config.token) return Promise.reject(new Error('أعد تحميل الصفحة بعد تغيير رمز Paddle.'));
  if (!instance) {
    configuredToken = config.token;
    instance = initializePaddle({ token: config.token, environment: config.environment, eventCallback: event => listeners.forEach(listener => listener(event)) })
      .then(paddle => { if (!paddle) throw new Error('تعذر تحميل نافذة Paddle.'); return paddle; })
      .catch(error => { instance = undefined; configuredToken = undefined; throw error; });
  }
  return instance;
}
