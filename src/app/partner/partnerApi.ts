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
  priceAnnual: number | null;
  renewalRate: number;
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
