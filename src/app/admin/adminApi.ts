const STAFF_TOKEN_KEY = 'onwan_staff_token';

export type StaffMember = {
  id: string;
  email: string;
  name: string;
  role: 'manager' | 'staff';
  permissions: string[];
  isActive: boolean;
};

export function getStaffToken() {
  return localStorage.getItem(STAFF_TOKEN_KEY);
}

export function setStaffToken(token: string | null) {
  if (token) {
    localStorage.setItem(STAFF_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(STAFF_TOKEN_KEY);
  }
}

// Raised on 401 so the shell can drop back to the login form.
export class StaffSessionExpired extends Error {}

export async function adminCall<T = any>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const token = getStaffToken();
  let response: Response;

  try {
    response = await fetch('/api/admin', {
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
    const message = payload?.error || `تعذر تنفيذ الطلب (رمز ${response.status}).`;

    if (response.status === 401 && token) {
      setStaffToken(null);
      throw new StaffSessionExpired(message);
    }

    throw new Error(message);
  }

  return payload as T;
}
