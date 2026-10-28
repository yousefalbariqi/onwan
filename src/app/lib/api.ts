import { clearSessionToken, getSessionToken } from './session';
import { takeTurnstileToken } from './turnstile';

// Keeps the status, so a «wait before resending» (429) is shown calmly, not as a failure.
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Seconds to wait before another code, when the server said so; else 0.
export function resendWait(error: unknown) {
  const match = error instanceof ApiError ? /^resend_wait:(\d+)$/.exec(error.code ?? '') : null;
  return match ? Number(match[1]) : 0;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  authenticated?: boolean;
  signal?: AbortSignal;
};

export type Plan = 'monthly' | 'annual';

export type Account = {
  kind?: 'standard' | 'nonprofit';
  email: string;
  phone: string;
  emailVerified: boolean;
  mustChangePassword?: boolean;
  // The name is held until the payment fixes it; changeable until then.
  nameFixed: boolean;
  nameHoldExpiresAt: string | null;
  pageStatus: 'draft' | 'published' | 'suspended';
  suspensionMessage: string;
  subscription: {
    plan: Plan;
    status: 'pending_payment' | 'active' | 'expired';
    startsAt: string | null;
    expiresAt: string | null;
    renewalInvoice: {
      number: number;
      plan: Plan;
      amount: number;
      dueAt: string | null;
    } | null;
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
      signal: options.signal,
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
    throw new ApiError(errorMessage, response.status, payload?.code);
  }

  return payload as T;
}

export function checkUsername(username: string, signal?: AbortSignal) {
  return request<{
    available: boolean;
    normalized: string;
    reason: string | null;
    status: 'available' | 'invalid' | 'reserved' | 'taken';
  }>(`/api/username/check?username=${encodeURIComponent(username)}`, { signal });
}

export function signup(input: { username: string; phone: string; email: string; password: string; nonprofit?: boolean; organizationName?: string }) {
  const partnerRef = sessionStorage.getItem('onwan_partner_ref');
  return request<AuthResponse>('/api/auth/signup', { method: 'POST', body: { ...input, partnerRef, turnstileToken: takeTurnstileToken() } }).then(response => {
    sessionStorage.removeItem('onwan_partner_ref');
    return response;
  });
}

export function login(identifier: string, password: string) {
  sessionStorage.removeItem('onwan_partner_ref');
  return request<AuthResponse>('/api/auth/login', { method: 'POST', body: { identifier, password, turnstileToken: takeTurnstileToken() } });
}

export function requestPasswordReset(email: string) {
  return request<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: { action: 'request', email, turnstileToken: takeTurnstileToken() },
  });
}

export function confirmPasswordReset(email: string, code: string, password: string) {
  return request<AuthResponse>('/api/auth/reset-password', {
    method: 'POST',
    body: { action: 'confirm', email, code, password },
  });
}

export function sendEmailCode() {
  return request<{ message: string; sent?: boolean; retryAfter?: number }>('/api/auth/email-code', {
    method: 'POST',
    authenticated: true,
    body: { action: 'send' },
  });
}

export function verifyEmailCode(code: string) {
  return request<{ account: Account }>('/api/auth/email-code', {
    method: 'POST',
    authenticated: true,
    body: { action: 'verify', code },
  });
}

export function fetchMyPage() {
  return request<{ pageData: any; account: Account; draft?: { pageData: any; savedAt: string } | null }>('/api/page/me', {
    authenticated: true,
  });
}

// REQ-015: the unpublished draft, kept on the server for the owner only.
export function saveMyDraft(pageData: any | null) {
  return request<{ savedAt: string | null }>('/api/page/me', {
    method: 'PATCH',
    authenticated: true,
    body: { draft: true, pageData },
  });
}

export function saveMyPage(pageData: any) {
  return request<{ pageData: any; account: Account }>('/api/page/me', {
    method: 'PATCH',
    authenticated: true,
    body: { pageData, slim: true },
  });
}

// By page name, or by the entity's own domain when opened on one (DOMAIN-03).
export function fetchPublicPage(target: { username: string } | { host: string }) {
  const query = 'host' in target ? `host=${encodeURIComponent(target.host)}` : `username=${encodeURIComponent(target.username)}`;

  return request<{ pageData?: any; suspended?: boolean; message?: string; movedTo?: string; partnerStorefront?: string }>(`/api/public-page?${query}`);
}

export function reportPage(username: string, message: string) {
  return request<{ message: string }>('/api/report', { method: 'POST', body: { username, message } });
}

// Signed-in beneficiary actions other than editing the page (api/account.ts).
export function accountCall<T = any>(action: string, params: Record<string, unknown> = {}) {
  return request<T>('/api/account', {
    method: 'POST',
    authenticated: true,
    body: { action, ...params },
  });
}

export function sendSupportRequest(type: RequestType, message: string) {
  return accountCall<{ message: string }>('request.send', { type, message });
}

export function nonprofitCall<T = any>(body?: Record<string, unknown>) {
  return request<T>('/api/nonprofit', { method: body ? 'POST' : 'GET', authenticated: true, body });
}
