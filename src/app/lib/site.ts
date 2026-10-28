export const BRAND_NAME = 'عنوان';

// ACCT-03: every page lives on its own subdomain, name.onwan.link.
export const ROOT_DOMAIN: string = import.meta.env.VITE_ROOT_DOMAIN || 'onwan.link';

// PAGE-12: fixed WhatsApp number of the administration (digits with country
// code). The button is hidden until the number is configured.
export const SUPPORT_WHATSAPP: string = (import.meta.env.VITE_SUPPORT_WHATSAPP || '').replace(/\D/g, '');

// Must match USERNAME_PATTERN in api/_lib/username.ts.
export const USERNAME_PATTERN = /^(?=.{1,30}$)(?!.*--)[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export const MAX_LINKS = 30;

export function isNonprofitHost() {
  return typeof window !== 'undefined' && window.location.hostname.toLowerCase() === `nonprofit.${ROOT_DOMAIN}`;
}

// The control panel and staff/manager sign-in live on admin.onwan.link, off the
// public site. On a local dev host there are no subdomains, so the panel is
// reached at /admin instead; adminLink() gives the right path for each.
export const ADMIN_HOST = `admin.${ROOT_DOMAIN}`;

export function isAdminHost() {
  return typeof window !== 'undefined' && window.location.hostname.toLowerCase() === ADMIN_HOST;
}

export function isLocalHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host === 'localhost' || /^[0-9.]+$/.test(host) || host.endsWith('.local');
}

// A path inside the panel: root on the admin subdomain, under /admin in dev.
export function adminLink(sub = '') {
  const base = isAdminHost() ? '' : '/admin';
  return (base + sub) || '/';
}

export function pageHost(username: string) {
  return `${username}.${ROOT_DOMAIN}`;
}

export function pageUrl(username: string) {
  return `https://${pageHost(username)}`;
}

// The page name when the app is opened on name.onwan.link, otherwise null.
export function getSubdomainUsername() {
  if (typeof window === 'undefined') {
    return null;
  }

  const host = window.location.hostname.toLowerCase();
  const suffix = `.${ROOT_DOMAIN}`;

  if (!host.endsWith(suffix)) {
    return null;
  }

  const label = host.slice(0, -suffix.length);

  return label && label !== 'www' && label !== 'nonprofit' && label !== 'admin' && USERNAME_PATTERN.test(label) ? label : null;
}

// DOMAIN-03: the hostname when the app is opened on an entity's own domain
// (anything that is not ours and not a development host), otherwise null.
export function getCustomHost() {
  if (typeof window === 'undefined') {
    return null;
  }

  const host = window.location.hostname.toLowerCase();
  const ours = host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`) || host.endsWith('.vercel.app') || host.endsWith('.workers.dev');
  const local = host === 'localhost' || /^[0-9.]+$/.test(host) || host.endsWith('.local');

  return ours || local ? null : host;
}
