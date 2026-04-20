const SESSION_STORAGE_KEY = 'bio_sa_session_token';

export function getSessionToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(SESSION_STORAGE_KEY);
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

  localStorage.removeItem(SESSION_STORAGE_KEY);
}
