import { clearSessionToken, getSessionToken } from './session';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  authenticated?: boolean;
};

export type Plan = 'monthly' | 'annual';

export type Account = {
  email: string;
  phone: string;
  emailVerified: boolean;
  pageStatus: 'draft' | 'published' | 'suspended';
  suspensionMessage: string;
  subscription: {
    plan: Plan;
    status: 'pending_payment' | 'active' | 'expired';
    expiresAt: string | null;
  } | null;
};

export type AuthResponse = {
  token: string;
  pageData: any;
  account: Account;
};

export type RequestType =
  | 'message'
  | 'pause_page'
  | 'reactivate_page'
  | 'delete_account'
  | 'change_subdomain'
  | 'stop_renewal'
  | 'more_storage'
  | 'invoice';

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.authenticated) {
    const token = getSessionToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response: Response;

  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error('تعذر الاتصال بالخدمة. تأكد أن الـ API تعمل وأن إعدادات البيئة صحيحة.');
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    // 401: session expired. 403 "banned": the account was blocked (MOD-06).
    if (options.authenticated && (response.status === 401 || payload?.code === 'banned')) {
      clearSessionToken();
    }

    // A crashed serverless function answers with plain text, not JSON, so fall
    // back to the status code instead of a message that says nothing.
    const errorMessage =
      payload?.error || `تعذر تنفيذ الطلب (رمز ${response.status}). تحقق من إعدادات الخادم.`;
    throw new Error(errorMessage);
  }

  return payload as T;
}

export function checkUsername(username: string) {
  return request<{
    available: boolean;
    normalized: string;
    reason: string | null;
    status: 'available' | 'invalid' | 'reserved' | 'taken';
  }>(`/api/username/check?username=${encodeURIComponent(username)}`);
}

export function signup(input: { username: string; phone: string; email: string; password: string }) {
  return request<AuthResponse>('/api/auth/signup', { method: 'POST', body: input });
}

export function login(email: string, password: string) {
  return request<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } });
}

export function requestPasswordReset(email: string) {
  return request<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: { action: 'request', email },
  });
}

export function confirmPasswordReset(email: string, code: string, password: string) {
  return request<AuthResponse>('/api/auth/reset-password', {
    method: 'POST',
    body: { action: 'confirm', email, code, password },
  });
}

export function sendEmailCode() {
  return request<{ message: string }>('/api/auth/send-code', { method: 'POST', authenticated: true });
}

export function verifyEmailCode(code: string) {
  return request<{ account: Account }>('/api/auth/verify-code', {
    method: 'POST',
    authenticated: true,
    body: { code },
  });
}

export function fetchMyPage() {
  return request<{ pageData: any; account: Account }>('/api/page/me', {
    authenticated: true,
  });
}

export function saveMyPage(pageData: any) {
  return request<{ pageData: any; account: Account }>('/api/page/me', {
    method: 'PATCH',
    authenticated: true,
    body: { pageData },
  });
}

export function fetchPublicPage(username: string) {
  return request<{ pageData?: any; suspended?: boolean; message?: string }>(
    `/api/public-page?username=${encodeURIComponent(username)}`,
  );
}

export function fetchSubscription() {
  return request<{ plans: { plan: Plan; priceSar: number | null }[]; account: Account }>('/api/subscription', {
    authenticated: true,
  });
}

export function startCheckout(plan: Plan) {
  return request<{ checkoutUrl: string | null; paymentConfigured: boolean; account: Account }>(
    '/api/subscription',
    { method: 'POST', authenticated: true, body: { plan } },
  );
}

export function reportPage(username: string, message: string) {
  return request<{ message: string }>('/api/report', { method: 'POST', body: { username, message } });
}

export function sendSupportRequest(type: RequestType, message: string) {
  return request<{ message: string }>('/api/requests', {
    method: 'POST',
    authenticated: true,
    body: { type, message },
  });
}
