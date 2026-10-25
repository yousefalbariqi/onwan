const SESSION_STORAGE_KEY = 'bio_sa_session_token';
// Fired in this tab whenever the session ends (logout, expiry, ban), so the
// editor drops the previous account's page from memory at once (note 42).
export const SESSION_CLEARED_EVENT = 'onwan:session-cleared';
// Browser copies of a page: the unsaved draft and earlier saved versions.
export const DRAFT_STORAGE_KEY = 'bio_page_data';
export const HISTORY_STORAGE_PREFIX = 'onwan_design_history_';

export function getSessionToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(SESSION_STORAGE_KEY);
}

// Whose browser data this is: the signed-in user's id (read from the token
// this browser holds; the server still checks every request), or 'guest'.
export function sessionOwner() {
  const token = getSessionToken();
  if (!token) return 'guest';
  try {
    const payload = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.userId === 'string' ? `user:${payload.userId}` : 'unknown';
  } catch {
    return 'unknown';
  }
}

export function setSessionToken(token: string) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(SESSION_STORAGE_KEY, token);
}

export function clearSessionToken() {
  if (typeof window === 'undefined') {
    return;
  }

  const hadSession = localStorage.getItem(SESSION_STORAGE_KEY) !== null;
  localStorage.removeItem(SESSION_STORAGE_KEY);
  if (hadSession) window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
}

// Logout on a shared device: nothing of the account stays in this browser.
export function clearLocalAccountData() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(DRAFT_STORAGE_KEY);
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (key?.startsWith(HISTORY_STORAGE_PREFIX)) localStorage.removeItem(key);
  }
}
