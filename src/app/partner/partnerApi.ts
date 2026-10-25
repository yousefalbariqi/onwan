import { takeTurnstileToken } from '../lib/turnstile';
import { moveInlineMedia } from '../lib/mediaUpload';
import type { PageData } from '../context/PageContext';
const PARTNER_TOKEN_KEY = 'onwan_partner_token';

export type PartnerAccount = {
  id: string;
  shopName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  status: 'active' | 'suspended' | 'violation';
  priceMonthly: number | null;
  testMode?: boolean;
  slug?: string | null;
  priceAnnual: number | null;
  renewalRate: number;
  saleMonthly: number | null;
  saleAnnual: number | null;
};

export function getPartnerToken() {
  return localStorage.getItem(PARTNER_TOKEN_KEY);
}

export function setPartnerToken(token: string | null) {
  if (token) {
    localStorage.setItem(PARTNER_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(PARTNER_TOKEN_KEY);
  }
}

export async function partnerCall<T = any>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const token = getPartnerToken();
  if (params.pageData) params = { ...params, pageData: await moveInlineMedia(params.pageData as PageData, token) };
  // REQ-020: the public entry points carry the «لست روبوتًا» token.
  if (['apply', 'login', 'login.sendCode'].includes(action)) params = { ...params, turnstileToken: takeTurnstileToken() };
  let response: Response;

  try {
    response = await fetch('/api/partner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action, ...params }),
    });
  } catch {
    throw new Error('تعذر الاتصال بالخادم.');
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && token) {
      setPartnerToken(null);
    }

    throw new Error(payload?.error || `تعذر تنفيذ الطلب (رمز ${response.status}).`);
  }

  return payload as T;
}
