// Link names for name.onwan.link: a sensible first guess, and ready alternatives
// when a name is taken. Availability is always decided by the server.
const MAX = 30;
const PUBLIC_MAIL = new Set(['gmail', 'googlemail', 'hotmail', 'outlook', 'live', 'msn', 'yahoo', 'icloud', 'me', 'mac', 'proton', 'protonmail', 'aol', 'gmx', 'mail', 'yandex', 'zoho']);
const ROLE_ADDRESSES = new Set(['info', 'admin', 'contact', 'hello', 'support', 'sales', 'office', 'mail', 'test', 'no-reply', 'noreply']);
const SECOND_LEVEL = new Set(['com', 'net', 'org', 'edu', 'gov', 'med', 'sch', 'co']);

export function cleanLinkName(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX).replace(/-+$/g, '');
}

// A personal mailbox gives its name; a company mailbox gives the company's domain.
export function linkFromEmail(email = '') {
  const [local = '', domain = ''] = email.toLowerCase().trim().split('@');
  const parts = domain.split('.').filter(Boolean);
  if (parts.length < 2) return '';
  const owner = parts.length > 2 && SECOND_LEVEL.has(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2];
  // A government address must not turn into a public page name by itself.
  if (parts.includes('gov')) return '';
  if (!PUBLIC_MAIL.has(owner)) return cleanLinkName(owner);
  const person = cleanLinkName(local.split('+')[0]);
  return ROLE_ADDRESSES.has(person) ? '' : person;
}

const withEnding = (base: string, ending: string) => `${base.slice(0, MAX - ending.length).replace(/-+$/g, '')}${ending}`;

// Alternatives to try, best first. A reserved name gets no look-alikes.
export function linkCandidates(name: string, email = '', status?: string) {
  const base = cleanLinkName(name);
  const fromEmail = linkFromEmail(email);
  const variants = status === 'reserved' || !base ? [] : [withEnding(base, '-sa'), withEnding(base, '-ksa'), withEnding(base, '-page'), withEnding(base, '1'), withEnding(base, '2'), withEnding(base, '3')];
  const invalidFix = status === 'invalid' && base !== name ? [base] : [];
  const emailOptions = fromEmail && fromEmail !== base ? [fromEmail, withEnding(fromEmail, '-sa')] : [];
  return [...new Set([...invalidFix, ...emailOptions, ...variants])].filter(item => item && item !== name);
}

// Stops as soon as enough free names are found, to keep the checks few.
export async function findAvailableLinks(candidates: string[], check: (name: string) => Promise<{ available: boolean }>, wanted = 3) {
  const found: string[] = [];
  for (const candidate of candidates.slice(0, 8)) {
    if ((await check(candidate)).available) found.push(candidate);
    if (found.length === wanted) break;
  }
  return found;
}
