import { clearSessionToken, getSessionToken } from './session';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  authenticated?: boolean;
};

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
    if (response.status === 401) {
      clearSessionToken();
    }

    const errorMessage = payload?.error || 'Unexpected request error';
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

export function sendCode(email: string, phone: string, username?: string) {
  return request<{
    message: string;
  }>('/api/auth/send-code', {
    method: 'POST',
    body: { email, phone, username },
  });
}

export function verifyCode(email: string, code: string) {
  return request<{
    token: string;
    isNewUser: boolean;
    user: { id: string; email: string; phone: string };
    pageData: any;
  }>('/api/auth/verify-code', {
    method: 'POST',
    body: { email, code },
  });
}

export function fetchMyPage() {
  return request<{ pageData: any }>('/api/page/me', {
    authenticated: true,
  });
}

export function saveMyPage(pageData: any) {
  return request<{ pageData: any }>('/api/page/me', {
    method: 'PATCH',
    authenticated: true,
    body: { pageData },
  });
}

export function fetchPublicPage(username: string) {
  return request<{ pageData: any }>(`/api/public-page?username=${encodeURIComponent(username)}`);
}
